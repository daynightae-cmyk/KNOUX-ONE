# Windows Runtime Evidence Template

Per service create:
```
runtime-evidence/<serviceId>/<timestamp>/
  machine.json
  binary.json
  input.json
  pre-state.json
  trace.jsonl
  result.json
  post-state.json
  artifacts/
  hashes.txt
  restore-result.json   # when reversible
  screenshots/         # optional supplemental UI proof
```

Promotion rule: no `RUNTIME_VERIFIED` without a complete evidence directory and an automated/peer-verifiable assertion of the expected post-state.
