---
name: information-gathering
description: Red-team target-development methodology for scope-safe collection, evidence modeling, and hypothesis generation.
---

# Target Development Methodology

Use this knowledge to structure red-team information gathering before validation. The goal is to reduce uncertainty, model the target accurately, and produce evidence-backed leads with clear confidence and gaps.

## Principles

1. Start with intelligence requirements. Define the decisions the information must support before collecting more data.
2. Scope is a control, not a note. Every entity, asset, identity, and relationship must be in scope, explicitly out of scope, or marked uncertain.
3. Build models, not lists. Raw asset lists become useful only when ownership, function, trust, exposure, and business relevance are understood.
4. Keep facts, assumptions, inferences, hypotheses, and unknowns separate.
5. Prefer strong evidence over volume. A small verified chain is worth more than a large unqualified inventory.
6. Treat leads as hypotheses until direct evidence supports a stronger claim.
7. Preserve uncertainty. Known gaps guide the next collection step; hidden assumptions create bad decisions.

## Workflow

1. Frame the objective.
   Define the target, authorized scope, expected outcome, constraints, time horizon, data handling limits, and stop conditions. Convert broad requests into explicit intelligence requirements.

2. Establish target identity.
   Map legal names, brands, business units, subsidiaries, acquisitions, product names, regions, aliases, and historical names. Classify each relationship as confirmed, likely, possible, or unknown.

3. Build the asset model.
   Map domains, network ranges, applications, APIs, portals, repositories, documentation, support surfaces, externally hosted services, third-party dependencies, and legacy footprints. For each asset, record function, owner confidence, scope basis, and relevance.

4. Build the identity model.
   Model people, roles, account patterns, login surfaces, reset flows, administrative boundaries, federation hints, service accounts, and role assumptions. Do not assume credential validity or access.

5. Build the technology model.
   Identify observable application stacks, infrastructure patterns, authentication mechanisms, deployment signals, integrations, exposed metadata, client behavior, dependency indicators, and version evidence when directly supported.

6. Build the organization model.
   Understand business functions, critical processes, public teams, outsourced operations, vendor relationships, release patterns, operational priorities, and likely high-value workflows.

7. Build the exposure model.
   Classify visible surfaces by purpose and risk traits: public content, authenticated applications, administrative interfaces, developer surfaces, file exchange paths, remote access surfaces, sensitive metadata, trust boundaries, and misconfiguration indicators.

8. Correlate evidence.
   Connect assets, identities, technologies, and business context into coherent observations. Maintain a traceable chain from every inference back to observed evidence.

9. Generate leads.
   Convert correlated observations into testable hypotheses. Each lead must state the affected asset, suspected weakness or exposure, why it matters, supporting evidence, confidence, constraints, and the condition that would confirm or disprove it.

10. Prioritize.
    Rank leads by scope certainty, evidence strength, mission relevance, likely impact, validation cost, and operational risk. Avoid severity language unless impact is evidenced.

11. Report.
    Present the target model, prioritized leads, evidence, confidence, gaps, and recommended next collection or validation steps. Keep claims proportional to evidence.

## Evidence Standard

- Confidence levels: confirmed, likely, possible, unknown.
- Every claim needs a source, observation time, observed fact, inference, and confidence.
- Prefer direct observations over copied, cached, stale, or third-party summaries.
- Absence of evidence is a gap, not proof of absence.
- Do not claim exploitability, compromise, business impact, or attribution from reconnaissance alone.
- Do not treat a single weak indicator as proof of ownership, exposure, or risk.
- If evidence conflicts, preserve the conflict and explain which source is stronger.
