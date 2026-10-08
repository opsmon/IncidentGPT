# feat: add deployment change timeline to incidents

**Status:** Implemented locally and validated; not published. No production deployment or real Argo CD controller validation performed.

## Problem and behavior

Incident pages lacked recorded deployment changes preceding the first symptoms, and the last-deployment tile incorrectly used incident creation time. This change adds a real Redis-backed metadata timeline and removes that fabricated deployment timestamp. Changes are leads with explicit correlation-only wording.

`backend/changes.go` adds a versioned ChangeEvent, authenticated webhook ingestion, fail-closed sanitizer calls, atomic deduplication/index writes, retention and paginated lookup. Lookup uses the incident's cluster, namespace, actual Deployment/workload identity and earliest valid alert source start time. Unknown identity or time is reported rather than silently substituting ingestion time. `ui/src/components/RecentChanges.tsx` renders safe revision links, upstream/observation timestamps, images, relevance explanations, coverage, source filtering, pagination, loading, missing-history, error and permission states.

`enricher/changes.go` polls allowlisted Deployment/ReplicaSet metadata with namespace/page/event/time budgets. Stable UID/generation/phase keys survive redelivery and restart without duplicate stored records. Failed sink calls remain eligible on the next sweep. Explicit coverage intervals expose restart gaps and stale heartbeats. `enricher/k8s.go` resolves Pod → ReplicaSet → Deployment ownership instead of guessing names. Existing RBAC already grants required get/list permissions; no Secret/ConfigMap reads or RBAC expansion.

## Scope, branches and dependencies

Base: `main`, starting commit `7b2ffd6b36445f529d1841b4d6a16b7ed6c281ca`.
Head: `feat/incident-change-timeline`. Implementation commit: see the index for the local commit hash.
First change in a six-change stack. Shared event/cluster/incident/request identities establish the base for PR 2. No arbitrary Git scanning, dependency causality or Terraform analysis.

After merge, rebase PR 2 onto the actual default branch and retarget it, then replay/revalidate successors in merge order. Nothing has been pushed, merged or published.

## API, data and configuration

- `POST /api/v1/changes` and `POST /api/v1/changes/coverage`: Bearer service credential; Redis required. New change ingestion has a maximum of eight concurrent requests and bounded sanitizer retries/timeouts.
- `GET /api/v1/incidents/{id}/changes?offset=0&limit=25`: backend-verified Basic credentials; spoofed X-Auth-User is rejected. Existing single-admin incident access scope applies.
- `igpt:change:<id>` and hashed workload-specific sorted-set indexes; atomic Lua writes/deduplication, TTL and time-range cleanup. No new incident-wide storage scans.
- Stable `cluster_id` and `analysis_request_id` fields are additive. Backend forwarding adds `incident_id`, `analysis_id` and `cluster_id`; legacy alert fields remain readable.
- Known-cluster correlation keys/fingerprints are scoped to prevent cross-cluster collisions.
- Backend/enricher Secret references, feature flags and retention settings are in component values. Sanitizer NetworkPolicy allows same-namespace backend callers.
- CI provisions disposable Redis for backend integration tests; fake sanitizer/Kubernetes providers remain deterministic.

Configuration, contracts, retention, Redis AOF/backup assumptions, historical coverage, Argo CD examples and rollback details are documented in `docs/roadmap/change-timeline.md`. `docs/fixtures/argocd-change.json` and `argocd-notifications.yaml` provide an application-specific normalized adapter. README links the actual implementation.

## Compatibility and migration

Disabled by default. Existing incidents are not rewritten. Cluster labels and stored ownership metadata can serve as read-time fallbacks; missing cluster/workload/symptom/analysis identity stays unknown. Legacy unscoped fingerprints do not safely identify known-cluster alerts; those alerts may start a fresh incident after upgrade. Old incident histories remain accessible. No fabricated historic changes or source timestamps are backfilled. Legacy last-deploy timestamps from incident creation are suppressed on Redis reads. Existing enrichment, raw alert visibility, Markdown analysis and Telegram paths remain; new envelope identity fields are additive.

## Validation

Passed:

- Baseline `go test ./...` separately in backend, enricher, ai-worker and sanitizer.
- From backend and enricher: `go vet ./...`, `go build ./...`, `go test -race ./...`.
- From backend: `INCIDENTGPT_TEST_REDIS_ADDR=127.0.0.1:16387 go test -race ./...` with dedicated Redis 7.2.7. Tests cover duplicate delivery, out-of-order source timestamps, pagination, unrelated workloads/clusters, sensitive metadata removal, rejected raw diffs/unsafe links, sanitizer failure and backend credential checks.
- Collector tests exercise bounded list requests, metadata allowlisting, sink failure recovery, unchanged polling, restart-stable event IDs, template changes and cross-cluster group separation.
- From ui: `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`; existing large-bundle warning remains.
- `helm lint backend/chart`, `helm lint enricher/chart/incidentgpt-enricher`, `helm lint sanitizer/chart`, `helm dependency build deploy/incidentgpt`, `helm lint deploy/incidentgpt`.
- `helm template` for enabled component charts and umbrella chart with feature disabled/enabled.
- `git diff --check`.

Initial failures corrected:

- Collector fake Kubernetes response lacked JSON type metadata/content type; corrected fixture, race suite passed.
- Local Redis bind/connect and Go-cache operations were blocked by sandbox; rerun with granted access, passed.
- Helm repository DNS was blocked in sandbox. All umbrella dependencies are local and built successfully. Escalated repository refresh timed out on the unrelated configured Bitnami repo but completed local dependency packaging and lint.

Not run: production Kubernetes rollout, real Argo CD template rendering, browser interaction tests, container builds (Docker daemon unavailable), kubeconform schema validation, live Telegram/LLM egress. No live-provider claims are made.

## Rollout and rollback

Deploy compatible backend/UI first, configure shared service token, reader credentials and sanitizer HMAC through existing Secrets, then enable one explicit collector namespace. Verify coverage and sanitizer policy before expansion. Set a unique stable CLUSTER_ID shared by alerts and changes. Redis must use noeviction and suitable persistence/backup; single-node Redis is not disk-loss tolerant.

Disable the collector first, then backend CHANGES_ENABLED. Downgrade backend/UI/enricher normally; additive keys expire by retention. Preserve incident history and credentials when keeping disabled-status reads available. See the operating document for exact values and retention behavior.

## Limitations and reviewer focus

Polling can miss changes between polls and cannot reconstruct historic configuration; collection budgets can leave partial coverage. Webhook-only installations show unknown Kubernetes coverage. Source filters apply to the current page. Routing-identity pseudonymization is unsupported and rejected if sanitizer changes identities. The existing shared-admin access model is retained, not expanded into per-team authorization. Existing legacy API authentication and unbounded listing are not redesigned in this change.

Review identity stability, time semantics, fail-closed persistence, bounded indexes/collectors, safe URL handling, realistic coverage messaging and the documented legacy fingerprint migration.
