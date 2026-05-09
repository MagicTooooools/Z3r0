---
name: perimeter-initial-access
description: Red-team perimeter validation methodology for prioritizing exposed touchpoints, testing safely, and classifying entry opportunities.
---

# Perimeter Validation Methodology

Use this knowledge to structure authorized perimeter testing against externally exposed assets. The goal is to move from scoped exposure to validated, evidence-backed entry opportunities while preserving stability, scope control, and evidence quality.

## Principles

1. Authorization defines the perimeter. Every target, technique class, credential source, data handling path, and test intensity must be covered.
2. Ownership must be clear before testing. Treat shared infrastructure, third-party services, inherited records, and adjacent assets as out of scope until confirmed.
3. Validate one question at a time. A perimeter test should have a single hypothesis and a defined stop condition.
4. Move from observation to low-impact confirmation before behavior-changing validation.
5. Preserve service stability. Avoid destructive payloads, persistence, data modification, excessive concurrency, and uncontrolled breadth.
6. Evidence should prove the condition with the least sensitive data possible.
7. Keep states distinct: exposure, suspected vulnerability, validated vulnerability, validated access, and impact.

## Workflow

1. Confirm operating boundaries.
   Record target list, allowed technique classes, testing windows, rate limits, credential rules, data handling limits, escalation boundaries, stop conditions, and emergency contacts.

2. Normalize the perimeter inventory.
   Group externally visible assets by ownership confidence and function: web applications, APIs, identity portals, remote access surfaces, administrative panels, file exchange surfaces, infrastructure services, developer surfaces, and cloud-facing endpoints.

3. Select candidate touchpoints.
   Prioritize assets by scope certainty, business relevance, exposure type, authentication boundary, trust boundary, attack surface richness, evidence quality, and operational risk. Prefer candidates that are both mission-relevant and safely testable.

4. Baseline behavior.
   Establish normal behavior before validation: authentication requirements, authorization boundaries, error patterns, redirects, session behavior, input handling, account flows, rate limits, visible integrations, and data exposure patterns.

5. Form validation hypotheses.
   Convert observations into precise questions: Is access control enforced? Is authorization role-bound? Is input handled safely? Is sensitive metadata exposed? Is a default or weak configuration present? Is an administrative function reachable? Is a trust boundary crossed?

6. Choose the minimum test.
   Select the smallest action that can confirm or disprove the hypothesis. Avoid chaining until the single condition is understood and documented.

7. Execute with guardrails.
   Stay inside allowed target, method, timing, and intensity. Stop on instability, unexpected sensitive data exposure, out-of-scope redirection, or signs that the test would alter production state beyond authorization.

8. Classify the result.
   Mark each candidate as not reproducible, informational exposure, suspected vulnerability, validated vulnerability, validated access, blocked by constraint, or out of scope. State what is proven and what remains unproven.

9. Assess impact conservatively.
   Tie impact to demonstrated capability and reachable data or function. Do not claim broader compromise, privilege escalation, lateral movement, or business impact without evidence.

10. Document the path.
    Preserve target, scope basis, baseline, hypothesis, test condition, request context, response evidence, timestamps, account context if any, observed effect, classification, confidence, and stop reason.

## Validation Rules

- Recheck scope before moving from one asset, tenant, account, domain, or environment to another.
- Do not use credentials, secrets, tokens, or accounts unless their use is explicitly authorized.
- Do not persist access, modify data, delete data, disrupt service, or collect sensitive content beyond minimum proof.
- If a test exposes sensitive data, stop collection and document only the minimum evidence needed.
- If the result depends on timing, state, account role, environment, or prior interaction, record that dependency.
- If a condition cannot be reproduced, keep it as a lead rather than a validated finding.
- If validation would require higher-impact action than authorized, stop at the current classification.

## Result Classifications

- Not reproducible: the condition could not be repeated with the allowed method.
- Informational exposure: evidence shows exposure, but not a confirmed vulnerability.
- Suspected vulnerability: evidence suggests weakness, but validation is incomplete.
- Validated vulnerability: the weakness is reproducible and supported by direct evidence.
- Validated access: testing demonstrates access to a protected function, context, or data boundary.
- Blocked by constraint: validation would exceed authorization, risk tolerance, or available context.
- Out of scope: the candidate is not covered by authorization.
