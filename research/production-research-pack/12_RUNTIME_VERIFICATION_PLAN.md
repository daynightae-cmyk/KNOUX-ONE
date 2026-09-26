# Runtime Verification Plan

`STATIC_VERIFIED` becomes `RUNTIME_VERIFIED` only after a Windows evidence pack exists.

Minimum evidence:
1. Windows edition/build/architecture.
2. KNOUX binary version and exact source SHA `9ac54af896d248d1d948f83d52920bf890cf9866` or later tested SHA.
3. Service ID and handler ID.
4. Typed input.
5. Pre-state.
6. Execution trace / API or fixed command evidence.
7. Structured output.
8. Post-state.
9. Artifact hash when output is a file.
10. Restore verification when the service claims reversibility.
11. Screenshots only as supplemental UI evidence.
12. Test result + timestamp.

CI success proves build/test gates, not that every service works on a real machine with real privileges, devices, policies, paths and failure modes.
