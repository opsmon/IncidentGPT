# Operator interface and guide review

The interface uses a navy workspace, readable text tokens, teal interactive accents
and separate severity colors. The main changes are the responsive navigation,
shift overview, paginated/filterable incident queue, incident workspace tabs and an
in-app on-call guide. Shared buttons/cards/inputs retain existing APIs and routes.

## Visual references

All captures use deterministic API fixtures, marked in the images. They illustrate
layout and UI behavior, not a connected cluster or a production deployment.

| Screen | Desktop | Mobile (390px) |
| --- | --- | --- |
| Shift overview | [Overview](images/ui/desktop-overview.png) | [Overview](images/ui/mobile-overview.png) |
| Incident queue | [Queue](images/ui/desktop-incidents.png) | [Queue](images/ui/mobile-incidents.png) |
| Incident workspace | — | [Workspace](images/ui/mobile-incident.png) |
| On-call guide | — | [Guide](images/ui/mobile-guide.png) |

## Candidate validation

Local UI TypeScript checking and production build passed. The existing bundle-size
warning remains. Helm dependency packaging, umbrella lint and rendering passed
with [the new preview values](examples/values-preview.yaml). Those are template
checks; placeholders must be replaced and secrets supplied before deployment.

A headless Microsoft Edge session with Playwright, local Vite and intercepted API
fixtures passed 14 checks on 2026-10-19:

- Overview data rendering and desktop layout.
- 25-row pagination, the second page and browser Back.
- Severity/status filters and reset, including transmitted API query parameters.
- Debounced search, slash shortcut, empty results and recovery.
- Failed list load and retry recovery.
- Incident deep links and keyboard focus on arrow/Home tab navigation.
- Unsaved resolution retained across workspace tabs.
- Failed assignment retains its dialog and entered owner; a successful retry closes it.
- Mobile menu selection, Escape and return of focus.
- Every incident workspace at 390px without page-level horizontal overflow.
- Guide deep link, FAQ and mobile layout.
- Failed dashboard stats display unknown measurements rather than healthy zero counts.
- Additional incident/list/guide overflow checks at 320px and 768px.
- No uncaught browser exceptions across the scenario.

Main screenshots were reviewed at 1440px and 390px. Fixtures exercise UI behavior
without making real mutations or provider calls. They do not verify backend
credentials, Redis persistence, live integrations, a browser/platform matrix or
production ingress/TLS. Existing backend APIs and storage are unchanged.

CI results and the exact candidate hash belong in the PR. A candidate deployment
with intended configuration, image digests and ingress/health/smoke evidence is
still required before merge under the repository working agreement. The local
Docker daemon was unavailable during this work; no production deployment or
promotion was performed.

## Instructions

[Getting started](getting-started.md) covers building the candidate, a separate
preview, credentials, the first alert, expected outcomes and troubleshooting.
[Web UI](web-ui.md) describes navigation, deep links, editor persistence and access.
[UI development](../ui/README.md) explains local API/demo modes and their limits.
The in-app `/help` page focuses on the on-call workflow rather than deployment.
