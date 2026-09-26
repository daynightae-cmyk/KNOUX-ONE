# UI Control Model

Every service gets a real workspace, not `[icon] [title] [Run]`.

## Simple mode

- scope/source picker;
- safe preset;
- obvious include/exclude controls;
- Scan/Preview;
- review results;
- selection controls;
- Preview Changes for mutations;
- Apply Selected;
- Restore when real;
- Export.

## Advanced mode

Only expose typed bounded controls that change the actual engine:
- depth / size / age thresholds;
- include/exclude patterns;
- concurrency and timeout within safe limits;
- algorithm / hash / similarity presets;
- ports/DNS targets through typed fields;
- sampling interval;
- evidence verbosity;
- result limits;
- provider choice when an external provider is optional.

## Per-service status strip

Always show:
`Data source | Privilege | Risk | Can cancel | Can restore | Offline | Last evidence`

## Results

Choose the visualization from the data:
- table for inventory;
- tree/treemap for storage;
- cluster view for duplicates;
- timeline for performance/history;
- diff/before-after for mutations;
- graph only when relationships matter;
- terminal/evidence drawer for technical proof.
