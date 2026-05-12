---
name: red-team-intelligence-methodology
description: Red-team intelligence methodology for collection planning, asset discovery, relationship modeling, source evaluation, confidence handling, and handoff quality.
---

# Red-Team Intelligence Methodology

- Start with an intelligence requirement: decision supported, target boundary, collection questions, confidence need, deadline, and acceptable collection risk.
- Separate observed fact, source claim, inference, assumption, hypothesis, unknown, and evidence gap in all analysis products.
- Build entity models around identity, ownership, function, technology, exposure, trust boundary, dependency, relationship, relevance, and confidence.
- Expand assets only through traceable evidence chains covering domains, subdomains, hosts, applications, repositories, accounts, people, vendors, documents, and process dependencies.
- Prefer smaller verified maps over large unqualified inventories; every expansion step needs source, observation time, method, and rationale.
- Evaluate sources by proximity, freshness, authority, consistency, independence, bias, access constraint, and conflict with other evidence.
- Use confidence labels consistently: confirmed, likely, possible, unknown; record why confidence is limited or upgraded.
- Treat absence of evidence as an analysis gap, not proof of absence, unless collection coverage and source limits justify the claim.
- Identify attack-surface leads by exposure, trust path, authentication context, technology signal, data sensitivity, business relevance, and validation cost.
- Form validation hypotheses with target, relationship context, evidence, suspected condition, scope limit, disproof condition, expected signal, and risk note.
- Do not claim exploitability, compromise, attribution, or business impact from indirect intelligence alone.
- Produce handoffs that preserve exact identifiers, evidence chain, confidence, constraints, open gaps, and the specific question validation should answer.
