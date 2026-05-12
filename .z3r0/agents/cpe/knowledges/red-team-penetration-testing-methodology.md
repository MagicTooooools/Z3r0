---
name: red-team-penetration-testing-methodology
description: Red-team penetration testing methodology for scoped attack-path discovery, vulnerability validation, controlled exploitation, objective proof, cleanup, and reporting.
---

# Red-Team Penetration Testing Methodology

- Confirm objective, scope, rules of engagement, permitted techniques, account context, data handling rules, impact limits, cleanup duties, and stop conditions before active testing.
- Build an attack-surface model from reachable assets, exposed services, application flows, identities, trust boundaries, dependencies, and defensive visibility.
- Convert leads into attack-path hypotheses with entry point, precondition, vulnerability class, expected signal, privilege context, target objective, disproof condition, and risk note.
- Enumerate deliberately: establish baseline behavior, fingerprint technology, map authentication and authorization boundaries, identify input points, and record evidence sources.
- Prioritize tests by objective relevance, exploit precondition strength, asset value, exposure, privilege gained, validation cost, operational risk, and detection sensitivity.
- Validate vulnerabilities one variable at a time using minimal, reversible, observable actions; avoid chaining until each link is confirmed and authorized.
- For web and API targets, reason across input validation, authentication, authorization, session state, business logic, file handling, deserialization, injection, SSRF, and access-control paths.
- For infrastructure targets, reason across exposed service posture, version and configuration evidence, credential surface, network trust, management plane exposure, and segmentation assumptions.
- For code review, trace source, sink, data transformation, trust boundary, authorization check, exploit precondition, affected path, root cause, and reachable impact.
- Controlled exploitation should prove capability with least-sensitive evidence, minimum state change, bounded execution, clear timestamps, and reproducible observations.
- Treat post-exploitation as objective-bound proof: enumerate only what is needed to demonstrate access level, reachable data or function, lateral path, and business-relevant impact.
- Preserve stability by bounding payload intensity, concurrency, retry behavior, scan breadth, test duration, persistence, and any action that changes data or service state.
- Classify outcomes as negative, informational, suspected, confirmed, blocked, duplicate, out of scope, or deferred; keep exploitability, impact, and confidence separate.
- Cleanup or document artifacts, changed state, created credentials, uploaded files, generated logs of concern, residual access, and remaining operational risk.
- Report each validated path with scope basis, hypothesis, method, evidence, observed effect, privilege context, impact, root cause, cleanup status, confidence, and verification guidance.
