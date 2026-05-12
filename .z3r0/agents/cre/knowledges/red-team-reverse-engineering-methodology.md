---
name: red-team-reverse-engineering-methodology
description: Red-team reverse engineering methodology for scoped artifact intake, static and dynamic analysis, behavior validation, vulnerability discovery, exploitability assessment, controlled proof, cleanup, and reporting.
---

# Red-Team Reverse Engineering Methodology

- Confirm objective, scope, authorization basis, artifact handling rules, permitted tooling, execution environment, sensitive-data limits, disclosure constraints, cleanup duties, and stop conditions before analysis.
- Preserve artifact integrity by recording source, hash, version, architecture, format, signatures, dependencies, symbols, packing indicators, timestamps, and chain-of-custody notes.
- Build an artifact model from binary layout, platform assumptions, privilege context, trust boundaries, exposed interfaces, input sources, persistent state, network behavior, and defensive controls.
- Convert observations into reverse-engineering hypotheses with target component, expected behavior, precondition, analysis method, observable signal, disproving condition, security relevance, and risk note.
- Triage deliberately: identify file type, compiler/runtime hints, imports, strings, resources, sections, entropy, anti-analysis checks, configuration data, embedded credentials, and reachable entry points.
- Prioritize analysis by objective relevance, exposed attack surface, privilege boundary, reachable parser or protocol path, cryptographic or licensing logic, update mechanism, exploitability likelihood, and validation cost.
- Use static analysis to recover control flow, data flow, object layout, state machines, protocol fields, serialization formats, authorization checks, error paths, and security-sensitive sinks.
- Use dynamic analysis in isolated, instrumented environments with bounded inputs, snapshots, logging, tracing, breakpoints, emulation, and controlled network or filesystem dependencies.
- For native binaries, reason across memory ownership, bounds checks, integer conversion, use-after-free, type confusion, race windows, unsafe callbacks, syscall use, and mitigation posture.
- For managed, mobile, or scripted artifacts, reason across decompilation fidelity, reflection, dynamic loading, IPC, permission use, storage paths, certificate pinning, obfuscation, and runtime policy bypasses.
- For firmware, drivers, and embedded targets, reason across boot chain, update validation, debug interfaces, hardware assumptions, MMIO access, hardcoded secrets, service exposure, and fail-safe behavior.
- Validate security findings one variable at a time using minimal, reversible, observable tests; separate code reachability, triggerability, control influence, privilege context, and impact.
- Controlled proof should demonstrate capability with least-sensitive evidence, deterministic reproduction, minimum state change, bounded execution, clear timestamps, and crash or behavior artifacts suitable for verification.
- Treat patching, emulation bypasses, hook scripts, loaders, and harnesses as analysis aids: document their purpose, exact change, affected control path, reversibility, and any difference from production behavior.
- Report each validated result with artifact identity, scope basis, hypothesis, method, recovered logic, evidence, trigger conditions, exploitability assessment, impact, limitations, cleanup status, confidence, and verification guidance.
