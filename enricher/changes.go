package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// changeObservation matches the additive ChangeEvent v1 backend contract.
// No ConfigMaps, Secrets, env, annotations (except rollout revision), diffs or
// pod templates are serialized. Source time is unknown unless upstream provides it.
type changeObservation struct {
	Version        int        `json:"schema_version"`
	ID             string     `json:"event_id"`
	Cluster        string     `json:"cluster_id"`
	Namespace      string     `json:"namespace"`
	Workload       string     `json:"workload"`
	UID            string     `json:"resource_uid"`
	Source         string     `json:"source"`
	Type           string     `json:"event_type"`
	SourceAt       *time.Time `json:"source_timestamp,omitempty"`
	Revision       string     `json:"revision,omitempty"`
	Images         []string   `json:"images,omitempty"`
	PreviousImages []string   `json:"previous_images,omitempty"`
}

func deploymentObservation(d appsv1.Deployment, cluster string) changeObservation {
	e := changeObservation{Version: 1, Cluster: cluster, Namespace: d.Namespace, Workload: d.Name, UID: string(d.UID), Source: "kubernetes", Type: "rollout_observed", Revision: d.Annotations["deployment.kubernetes.io/revision"], Images: containerImages(d.Spec.Template.Spec.Containers)}
	if d.Status.ObservedGeneration >= d.Generation && d.Status.UpdatedReplicas == d.Status.Replicas && d.Status.AvailableReplicas == d.Status.Replicas {
		e.Type = "rollout_complete"
	}
	// Generation and phase distinguish template updates and observed rollout completion.
	e.ID = fmt.Sprintf("%s:%d:%s", d.UID, d.Generation, e.Type)
	return e
}
func replicaSetObservation(rs appsv1.ReplicaSet, cluster string) (changeObservation, bool) {
	workload := ""
	for _, owner := range rs.OwnerReferences {
		if owner.Kind == "Deployment" && owner.Controller != nil && *owner.Controller {
			workload = owner.Name
			break
		}
	}
	if workload == "" {
		return changeObservation{}, false
	}
	sourceAt := rs.CreationTimestamp.Time.UTC()
	return changeObservation{Version: 1, ID: string(rs.UID), Cluster: cluster, Namespace: rs.Namespace, Workload: workload, UID: string(rs.UID), Source: "kubernetes", Type: "deployment", SourceAt: &sourceAt, Revision: rs.Annotations["deployment.kubernetes.io/revision"], Images: containerImages(rs.Spec.Template.Spec.Containers)}, true
}
func containerImages(containers []corev1.Container) []string {
	images := make([]string, 0, len(containers))
	for _, c := range containers {
		images = append(images, c.Image)
	}
	return images
}
func observationKey(e changeObservation) string {
	b, _ := json.Marshal(e)
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

// Bounded polling was chosen over informers: limited namespaces and page/event
// budgets avoid maintaining a second unbounded cluster object cache. It cannot
// capture intermediate revisions that disappear between polls. Backend IDs make
// repeated lists/restarts idempotent; polling never synthesizes historical changes.
type changeCollector struct {
	client              kubernetes.Interface
	url, token, cluster string
	namespaces          []string
	started             time.Time
	http                *http.Client
	seen                map[string]string
	images              map[string][]string
}

func (c *changeCollector) post(ctx context.Context, path string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url+path, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.token)
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("collector backend unavailable")
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("collector backend HTTP %d", resp.StatusCode)
	}
	return nil
}
func (c *changeCollector) emit(ctx context.Context, e changeObservation, budget *int) error {
	key := e.UID + ":" + e.Type
	hash := observationKey(e)
	if c.seen[key] == hash {
		return nil
	}
	if *budget <= 0 {
		return fmt.Errorf("event budget exceeded")
	}
	*budget--
	imageKey := e.Namespace + "/" + e.Workload
	if e.Type == "rollout_observed" || e.Type == "rollout_complete" {
		e.PreviousImages = c.images[imageKey]
	}
	if err := c.post(ctx, "", e); err != nil {
		return err
	}
	if e.Type == "rollout_observed" || e.Type == "rollout_complete" {
		c.images[imageKey] = e.Images
	}
	c.seen[key] = hash
	return nil
}
func (c *changeCollector) collectNamespace(ctx context.Context, ns string) error {
	budget := 100
	options := metav1.ListOptions{Limit: 100}
	for page := 0; page < 10; page++ {
		list, err := c.client.AppsV1().Deployments(ns).List(ctx, options)
		if err != nil {
			return fmt.Errorf("deployment listing unavailable")
		}
		for _, d := range list.Items {
			if err := c.emit(ctx, deploymentObservation(d, c.cluster), &budget); err != nil {
				return err
			}
		}
		if list.Continue == "" {
			options.Continue = ""
			break
		}
		options.Continue = list.Continue
		if page == 9 {
			return fmt.Errorf("deployment page budget exceeded")
		}
	}
	options = metav1.ListOptions{Limit: 100}
	for page := 0; page < 10; page++ {
		list, err := c.client.AppsV1().ReplicaSets(ns).List(ctx, options)
		if err != nil {
			return fmt.Errorf("replicaset listing unavailable")
		}
		for _, rs := range list.Items {
			// Old ReplicaSets are not evidence of a recent change. Do not upload history
			// older than 24h; the timeline uses the real upstream creation time.
			if time.Since(rs.CreationTimestamp.Time) > 24*time.Hour {
				continue
			}
			e, ok := replicaSetObservation(rs, c.cluster)
			if !ok {
				continue
			}
			if err := c.emit(ctx, e, &budget); err != nil {
				return err
			}
		}
		if list.Continue == "" {
			break
		}
		options.Continue = list.Continue
		if page == 9 {
			return fmt.Errorf("replicaset page budget exceeded")
		}
	}
	// Fixed memory budget; clearing this optimization causes only deduplicated
	// reposts, never loss of durable event history in Redis.
	if len(c.seen) > 10000 {
		c.seen = map[string]string{}
		c.images = map[string][]string{}
	}
	return nil
}
func (c *changeCollector) sweep(ctx context.Context) {
	for _, ns := range c.namespaces {
		budgetCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		status := "collecting"
		if c.collectNamespace(budgetCtx, ns) != nil {
			status = "partial"
		}
		cancel()
		coverageCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		_ = c.post(coverageCtx, "/coverage", map[string]any{"cluster_id": c.cluster, "namespace": ns, "interval_started_at": c.started, "status": status})
		cancel()
	}
}
func startChangeCollector() {
	if os.Getenv("CHANGE_COLLECTOR_ENABLED") != "true" {
		return
	}
	namespaces := strings.Split(os.Getenv("CHANGE_COLLECTOR_NAMESPACES"), ",")
	cluster := envOr("CLUSTER_ID", appCfg.ClusterName)
	target := strings.TrimRight(os.Getenv("CHANGE_BACKEND_URL"), "/")
	token := os.Getenv("CHANGE_INGEST_TOKEN")
	if len(namespaces) > 20 || namespaces[0] == "" || cluster == "unknown" || target == "" || token == "" || k8sClient == nil {
		return
	}
	for i := range namespaces {
		namespaces[i] = strings.TrimSpace(namespaces[i])
		if namespaces[i] == "" {
			return
		}
	}
	interval, _ := strconv.Atoi(envOr("CHANGE_POLL_SECONDS", "60"))
	if interval < 30 || interval > 3600 {
		interval = 60
	}
	c := &changeCollector{client: k8sClient, url: target, token: token, cluster: cluster, namespaces: namespaces, started: time.Now().UTC(), http: &http.Client{Timeout: 5 * time.Second}, seen: map[string]string{}, images: map[string][]string{}}
	go func() {
		c.sweep(context.Background())
		ticker := time.NewTicker(time.Duration(interval) * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			c.sweep(context.Background())
		}
	}()
}
