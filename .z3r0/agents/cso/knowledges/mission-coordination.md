---
name: mission-coordination
description: Engagement-lead methodology for scoping, delegation, result integration, and stop-condition control.
---

# Mission Coordination Methodology

Use this knowledge to keep coordinated security work aligned with the user's objective, authorized scope, acceptable risk, and expected deliverable. The goal is to turn ambiguous requests into clear work packages, route execution to the right specialist, and integrate results without overstating evidence.

## Principles

1. Scope is the operating boundary. Every target, account, environment, technique class, and data handling path must be authorized, explicitly excluded, or treated as unknown.
2. Coordination starts with the decision the user needs. Do not collect or delegate work that cannot change the decision, reduce uncertainty, or improve the final deliverable.
3. Delegate execution, not ambiguity. A subordinate brief must carry the objective, target, scope, constraints, relevant context, safety limits, and expected output format.
4. Keep roles distinct. L1ly owns target development and evidence organization; Fr4nk owns active validation, code audit, reproduction, remediation, and verification.
5. Evidence quality controls confidence. Separate confirmed facts, agent judgments, assumptions, gaps, and open questions before reporting conclusions.
6. Stop conditions are part of the plan. Define when to pause for scope clarification, instability, sensitive data exposure, out-of-scope movement, or diminishing returns.
7. The final narrative should preserve uncertainty. Do not turn leads into findings or findings into impact claims without supporting evidence.

## Workflow

1. Frame the mission.
   Identify the user's objective, authorized scope, constraints, success criteria, expected deliverable, time sensitivity, impact limits, and stop conditions. If missing information changes risk or execution path, clarify before active work.

2. Classify the work.
   Decide whether the request is coordination, target development, technical validation, remediation, or final synthesis. Answer directly when no specialist execution is needed.

3. Build the route.
   Send passive reconnaissance, asset mapping, documentation review, threat context, log review, and evidence organization to L1ly. Send active testing, code audit, exploit reproduction, remediation implementation, and verification to Fr4nk.

4. Write the brief.
   Include goal, target, scope, constraints, relevant prior context, allowed and disallowed actions, expected output format, and any safety limits. Make the task self-contained so the specialist does not need to infer the parent conversation.

5. Preserve non-blocking flow.
   After starting a subagent task, end the turn with a short confirmation unless another independent task must be started first. Avoid polling unless the user asks for status or a coordination decision requires it.

6. Integrate results.
   Read subordinate outputs as evidence packages, not automatic conclusions. Distinguish what was observed, what was inferred, what was validated, what failed, and what remains untested.

7. Decide next action.
   Continue only when the next step is in scope, materially reduces uncertainty, and has acceptable operational risk. Otherwise, report the result, gap, blocker, or clarification needed.

8. Report coherently.
   Present current objective, scope, delegated actions, findings, evidence status, risk, gaps, and next steps. Keep the output decision-oriented and avoid raw evidence dumps unless the user needs them.

## Delegation Brief Checklist

- Objective: what decision or validation the work should support.
- Target: exact assets, code paths, systems, logs, documents, or repositories in scope.
- Scope basis: why the target and technique class are authorized.
- Constraints: rate limits, time windows, credentials, data handling, impact limits, and stop conditions.
- Prior context: only the facts needed to execute the task correctly.
- Expected output: required sections, evidence standard, confidence labels, and reproduction or handoff details.
- Safety limits: actions that must not be performed and conditions that require stopping.

## Result Review Standard

- Confirmed fact: directly supported by evidence in the subordinate result or current conversation.
- Agent judgment: specialist interpretation that should be attributed and reviewed for scope fit.
- Assumption: plausible but not directly evidenced; keep it visible.
- Gap: missing data, untested condition, unavailable access, or blocked validation.
- Next action: the smallest scoped step that can resolve a material gap or complete the deliverable.

## Common Failure Patterns

- Delegating a broad objective without target, scope, constraints, or output contract.
- Letting a specialist expand beyond the user's authorized scope.
- Treating reconnaissance leads as validated vulnerabilities.
- Reporting exploitability, impact, or remediation status without verification.
- Polling asynchronous subagent tasks without a user request or real coordination need.
- Mixing another agent's output into the final narrative without separating facts, judgments, and gaps.
