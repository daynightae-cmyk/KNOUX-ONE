# Terminal / Evidence Model

The terminal view is **not a shell**. It is a read-only rendering of the operation KNOUX executed.

Recommended record:
```json
{
  "operationId": "uuid",
  "serviceId": "MXX-SYY",
  "handlerId": "allowlisted.handler",
  "executable": "optional fixed executable",
  "argumentsRedacted": [],
  "privilege": "standard|administrator",
  "startedAt": "ISO-8601",
  "completedAt": "ISO-8601",
  "durationMs": 0,
  "exitCode": 0,
  "stdout": null,
  "stderr": null,
  "events": [],
  "changedObjects": [],
  "skippedObjects": [],
  "beforeEvidence": [],
  "afterEvidence": [],
  "warnings": []
}
```

Rules:
- copy is allowed;
- edit/re-run arbitrary command text is not;
- secret arguments are always redacted;
- API-only operations show API/interface and structured events rather than pretending there was a command line.
