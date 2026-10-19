# feat: add evidence-backed analysis with durable delivery

**Status:** Implemented locally; not published. Live providers and production rollout have not been exercised.

## Problem and implemented behavior

Legacy Markdown cannot reliably verify citations, reusable group callbacks can misroute late results, and process-local correlation timers/read-send-delete handoff can lose or strand batches. This change adds versioned evidence and immutable analysis records, validated structured output, leased Redis analysis jobs, acknowledged synchronous worker results, and persisted correlation snapshots/deadlines. New alerts arriving during delivery remain in a separate pending hash. Raw notification attempts remain independent of LLM completion.

The UI displays competing hypotheses, supporting/contradicting evidence links, missing-data warnings, version history and queued/running/retrying/terminal statuses. Legacy Markdown remains readable; its confidence is labeled uncalibrated self-assessment. New results update the list summary only when they are the latest requested analysis, and never overwrite older analysis records.

## Scope and dependencies

Base: `feat/incident-change-timeline` at `c250dbf`. Head: `feat/evidence-backed-analysis`; local implementation commit is recorded in the index. Depends on PR 1 identities, sanitizer/storage boundaries and reader credentials. Excludes general workflow engines, autonomous tools and remediation.

Rebase/retarget onto the actual default branch after PR 1 merges; replay/revalidate successors. No branch was pushed and no GitHub PR, production deployment or notification was published.

## API, data and configuration

Matching v1 wire contracts are in backend/worker `investigation_contracts.go`; consumers are `backend/jobs.go`, `ai-worker/structured.go` and `enricher/durable_correlation.go`. Redis stores immutable evidence/results, job envelopes, requested/latest pointers, incident indexes and batch idempotency mappings. Atomic scripts enforce scheduling, ownership, acknowledgement and latest-version ordering. Group ingress uses a Redis ownership lock and replays stored batch identities even after incident acknowledgement.

New routes: worker `POST /v1/analyze`; backend analysis versions, incident-owned evidence and jobs/metrics GET endpoints. Durable ingest/worker require ANALYSIS_SERVICE_TOKEN. History/evidence access verifies Basic credentials independently of actor headers. Legacy group-key callbacks return 409 in durable mode; synchronous leased completion routes by incident_id + analysis_id. They remain available in disabled legacy mode.

Feature flags default false: backend DURABLE_ANALYSIS_ENABLED and enricher DURABLE_CORRELATION_ENABLED. Worker STRUCTURED_OUTPUT_MODE defaults to bounded JSON-text compatibility; optional json_object requests native JSON mode. Existing Secrets can supply analysis-service-token; references remain optional for disabled compatibility deployments. Retention follows existing incidents (no automatic deletion), and durable queues have no TTL. Full contracts, migration, bounds, AOF/backup assumptions and rollback are in `docs/roadmap/evidence-and-delivery.md`.

## Validation

Passed:

- Host `go test -race ./...` in backend, enricher and ai-worker (Redis cases skipped without explicit address).
- Docker `docker compose -p incidentgpt-regression -f deploy/test-compose.yaml run --rm backend-tests`: full Redis integration/race suite, including duplicate jobs, lease exclusion, crash recovery, stale-owner fencing, out-of-order/duplicate completion, batch replay after acknowledgment, and fail-closed evidence persistence.
- Corresponding Docker `enricher-tests`: persisted deadlines, immutable snapshot handoff, retries without another alert, concurrent arrivals retained, stale acknowledgements rejected; existing collector/raw-dedup tests pass.
- Corresponding Docker `worker-tests`: structured output, cross-incident/fabricated citations, untrusted-data wrapper and sanitizer failure with no provider call; existing Telegram/sanitizer flow tests pass.
- Docker overrides `sh -c 'go vet ./... && go build -o /tmp/service . && go test -race ./...'` for all three components.
- UI `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`; existing large-bundle warning remains.
- `helm lint` for backend, enricher and worker; umbrella local dependencies and lint; `git diff --check`.

Initial failures corrected: new worker referenced the wrong Telegram config field; corrected to existing TGBotToken. Host vet/build attempts were blocked by Go-cache sandbox access; Docker vet/build replacements passed. An attempted repository-root go test command failed because the project uses separate modules; the corresponding module/container suites passed. No failed check is represented as passed without a successful rerun.

Not run: live LLM/Telegram providers, real worker process kill in Kubernetes, production multi-replica rollout, browser interaction tests, kubeconform schema validation. Crash tests expire/fence persisted leases deterministically. Docker test images compile code but production image builds are tracked separately if run.

## Rollout, rollback and operational impact

Deploy compatible worker/backend/UI; configure reader credentials, sanitizer HMAC and shared service token. Drain legacy grp:* buffers before enabling backend durable mode followed by enricher durable correlation. Existing Markdown and incidents need no fabricated backfill. Disable new enqueue, drain or pause durable jobs, retain queue/evidence data and then downgrade; older binaries do not consume queued v1 work. Redis noeviction, AOF/replication and backups are required for the intended durability. Single-node disk loss and everysec AOF windows remain real limits.

## Limitations and reviewer focus

Four attempts per analysis, eight per correlation batch; bounded consumer concurrency and input/output/timeout budgets. Terminal analysis failures appear beside the incident; correlation dead letters are retained in Redis for operator inspection rather than a full admin screen. Missing legacy source outcome/collection time remains unavailable/unknown, never inferred empty/fresh. Numeric usage/cost is retained only when returned; no calibrated confidence or measured reliability improvement is claimed. Telegram failures do not discard analysis; retries after uncertain delivery can duplicate messages. Multi-key scripts require the current single-primary Redis endpoint, not Redis Cluster. Existing legacy listing scans and full multi-tenancy are not redesigned.

Review atomic scheduling/handoff, replay mapping, lease fencing, immutable evidence/history, authorization and citation validation, deadline bounds, partial/unknown source semantics and downgrade order.
