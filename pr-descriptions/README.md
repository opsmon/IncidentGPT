# IncidentGPT six-PR implementation stack

**Prepared locally; not published.** All six changes are implemented and committed.
No branches were pushed, GitHub PRs published, deployments performed, or notifications
sent. Each linked body records implemented behavior, validation and limitations.

Repository: `https://github.com/opsmon/IncidentGPT`.
The actual default branch is `main` (`origin/HEAD`). Work began at
`7b2ffd6b36445f529d1841b4d6a16b7ed6c281ca` with a clean working tree.
See [baseline.md](../docs/roadmap/baseline.md) for baseline findings and checks.

| Merge order | PR description | Head branch | Initial base | Implementation commit | Dependencies | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | [feat: add deployment change timeline to incidents](PR-01-change-timeline.md) | `feat/incident-change-timeline` | `main` | `c250dbf4d6db33359b8bba9ba042161a5a7f528f` | Baseline | Implemented; prepared locally |
| 2 | [feat: add evidence-backed analysis with durable delivery](PR-02-evidence-and-delivery.md) | `feat/evidence-backed-analysis` | `feat/incident-change-timeline` | `85309c826b33931d76d6a566a0a0989652b1ef2a` | PR 1 | Implemented; prepared locally |
| 3 | [feat: retrieve confirmed incident resolutions and runbooks](PR-03-confirmed-memory.md) | `feat/confirmed-incident-memory` | `feat/evidence-backed-analysis` | `ab158bfaba216751c64f896f38c31cb8add62223` | PRs 1–2 | Implemented; prepared locally |
| 4 | [feat: add guided read-only incident diagnostics](PR-04-guided-diagnostics.md) | `feat/guided-incident-diagnostics` | `feat/confirmed-incident-memory` | `a3a621b9955e9d551db0e6cfd5439bae1e3a05c6` | PRs 1–3 | Implemented; prepared locally |
| 5 | [feat: correlate incidents using explicit dependency evidence](PR-05-dependency-correlation.md) | `feat/dependency-aware-correlation` | `feat/guided-incident-diagnostics` | `3b175686bdf2aa0a01f6b94200e8950078404104` | PRs 1–4 | Implemented; prepared locally |
| 6 | [feat: generate reviewed postmortems and incident handoffs](PR-06-postmortem-and-handoff.md) | `feat/postmortem-and-handoff` | `feat/dependency-aware-correlation` | `b2bb9e1001cb29d350df268f4ae58b08ef42d4ef` | PRs 1–5 | Implemented; prepared locally |

The final branch includes a separate documentation-only commit containing this index,
after its listed implementation commit. This remains exactly six PR-sized changes.
Each branch's diff against its declared predecessor contains only that incremental
change. The final branch contains the integrated implementation.

## Review and merge workflow

Review in the listed order, initially comparing each head with its declared base.
After a predecessor merges, retarget its successor to `main`. If merge commits preserve
the listed ancestor, check the resulting diff before publication. If a predecessor is
squashed or rebased, replay only the successor's incremental commits onto the new
`main`, then rebase remaining descendants and rerun relevant checks. Refresh recorded
hashes after that work. No publication or merge is authorized by this local task.

## Integrated validation

Passed: Go vet/build/race suites for backend, enricher and worker in Docker; disposable
Redis integration and deterministic six-feature HTTP workflow; sanitizer vet/race;
UI TypeScript and production build; modified Helm chart validation and inspected
feature-enabled/default/credential renders; all five production Docker image builds.
The final backend/enricher images include the last tested changes. Formatting and
diff checks passed. Exact commands, corrected failed checks and per-PR outcomes are
in the linked bodies. The UI retains its existing bundle-size warning.

Not run: live Kubernetes/Argo CD, live model/Telegram, interactive browser, load,
production canary or cross-platform image matrix. These are validation limits;
local implementation has no outstanding blocker. Optional external features remain
disabled by default and require operator configuration.

Operational constraints include shared-admin permissions, single-primary Redis/AOF
durability windows, bounded queries/compositions/reports, and operator retention for
non-expiring job/audit/lifecycle history. See the linked bodies and roadmap guides
before enabling features. External integrations configured only through legacy forms
are not presented as working collectors.
