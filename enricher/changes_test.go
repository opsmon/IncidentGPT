package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

func TestCollectorRestartAndMetadata(t *testing.T) {
	d := appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: "api", Namespace: "payments", UID: types.UID("deployment-uid"), Generation: 2, Annotations: map[string]string{"deployment.kubernetes.io/revision": "78", "secret": "must-not-leak"}}, Spec: appsv1.DeploymentSpec{Template: corev1.PodTemplateSpec{Spec: corev1.PodSpec{Containers: []corev1.Container{{Name: "api", Image: "registry.example/api:78", Env: []corev1.EnvVar{{Name: "PASSWORD", Value: "must-not-leak"}}}}}}}}
	payload, _ := json.Marshal(deploymentObservation(d, "prod-eu"))
	if strings.Contains(string(payload), "must-not-leak") {
		t.Fatal("collector read sensitive template fields")
	}
	kube := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Query().Get("limit") != "100" {
			t.Error("unbounded list")
		}
		switch r.URL.Path {
		case "/apis/apps/v1/namespaces/payments/deployments":
			_ = json.NewEncoder(w).Encode(appsv1.DeploymentList{TypeMeta: metav1.TypeMeta{APIVersion: "apps/v1", Kind: "DeploymentList"}, Items: []appsv1.Deployment{d}})
		case "/apis/apps/v1/namespaces/payments/replicasets":
			_ = json.NewEncoder(w).Encode(appsv1.ReplicaSetList{TypeMeta: metav1.TypeMeta{APIVersion: "apps/v1", Kind: "ReplicaSetList"}})
		default:
			t.Errorf("unexpected API read %s", r.URL.Path)
			http.Error(w, "unsupported", 400)
		}
	}))
	defer kube.Close()
	client, err := kubernetes.NewForConfig(&rest.Config{Host: kube.URL})
	if err != nil {
		t.Fatal(err)
	}
	var delivered []changeObservation
	fail := true
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer token" {
			t.Error("missing service authentication")
		}
		if fail {
			http.Error(w, "unavailable", 503)
			return
		}
		var e changeObservation
		_ = json.NewDecoder(r.Body).Decode(&e)
		delivered = append(delivered, e)
	}))
	defer backend.Close()
	collector := func() *changeCollector {
		return &changeCollector{client: client, url: backend.URL, token: "token", cluster: "prod-eu", started: time.Now(), http: backend.Client(), seen: map[string]string{}, images: map[string][]string{}}
	}
	c := collector()
	if c.collectNamespace(context.Background(), "payments") == nil {
		t.Fatal("failed sink reported complete")
	}
	fail = false
	if err := c.collectNamespace(context.Background(), "payments"); err != nil {
		t.Fatal(err)
	}
	if err := c.collectNamespace(context.Background(), "payments"); err != nil {
		t.Fatal(err)
	}
	if len(delivered) != 1 {
		t.Fatal("unchanged poll created event storm")
	}
	restarted := collector()
	if err := restarted.collectNamespace(context.Background(), "payments"); err != nil {
		t.Fatal(err)
	}
	if len(delivered) != 2 || delivered[0].ID != delivered[1].ID || delivered[1].SourceAt != nil {
		t.Fatal("restart fabricated history or changed id")
	}
	d.Spec.Template.Spec.Containers[0].Image = "registry.example/api:79"
	d.Generation++
	if err := c.collectNamespace(context.Background(), "payments"); err != nil {
		t.Fatal(err)
	}
	if len(delivered) != 3 || delivered[2].ID == delivered[0].ID || len(delivered[2].PreviousImages) != 1 {
		t.Fatal("template update missing")
	}
}

func TestClusterGroupingIdentity(t *testing.T) {
	a := EnrichedAlert{ClusterName: "prod-eu", Labels: map[string]string{"namespace": "payments"}}
	b := a
	b.ClusterName = "prod-us"
	if groupKeyFor(a) == groupKeyFor(b) {
		t.Fatal("clusters share correlation key")
	}
}
