# Runtime verification cycle 1 — plan

Cycle start: 2026-10-20
Target commit: `75b8a95` (`main` after the module documentation merge)
Local host: `DESKTOP-VQKU9P8`, Windows 10 Pro 10.0.19045, WebView2 155.0.4283.62

## Scope

This cycle moves catalog services from `STATIC_VERIFIED` to `RUNTIME_VERIFIED`
only when a real run on a Windows host satisfies all four stages recorded by
`docs/evidence/windows-runtime-evidence.json`:

1. the UI control is clicked,
2. the typed client crosses the Tauri IPC boundary,
3. the native Rust command executes,
4. the measured result is rendered back into the interface.

The 29 existing runtime records were captured on `DESKTOP-FCJJB5O`. They stay
valid for the services they name; this cycle adds records for the 86 services
that currently carry static evidence only.

A failed run is recorded as a defect. It is never converted into a pass, and no
service state is promoted by inference.

## Batch order

The 86 static services split into 54 read-only services and 32 that either need
elevation or change system state. Read-only services run first. Sensitive
services are separated so a failure cannot be confused with a destructive
action, and every sensitive action needs its documented typed confirmation.

### Batch A1 — read-only, no target selection (25)

M05-S01, M05-S02, M05-S03, M05-S05, M05-S06, M05-S10,
M06-S01, M06-S02, M06-S03, M06-S04, M06-S05, M06-S06, M06-S10,
M10-S06,
M15-S02, M15-S04, M15-S08,
M17-S01, M17-S02, M17-S03, M17-S04, M17-S05, M17-S06, M17-S07, M17-S08.

### Batch A2 — read-only with a selected project or folder (18)

M02-S07,
M03-S01, M03-S02, M03-S03, M03-S04, M03-S05, M03-S06, M03-S07, M03-S08, M03-S09,
M04-S01, M04-S07,
M15-S10,
M16-S05, M16-S06, M16-S08,
M17-S09, M17-S10.

### Batch A3 — read-only network probes (7)

M08-S01, M08-S02, M08-S03, M08-S04, M08-S05, M08-S09, M08-S10.

### Batch A4 — read-only privacy and restore inventory (4)

M09-S02, M09-S03, M09-S04, M11-S09.

### Batch B1 — read-only but elevated or flagged sensitive (7)

M02-S02, M02-S05,
M05-S04,
M07-S02, M07-S03,
M10-S01, M10-S05.

### Batch B2 — reversible state changes (13)

M01-S08,
M03-S10,
M05-S07, M05-S08, M05-S09,
M06-S07, M06-S08, M06-S09,
M08-S06,
M09-S06,
M11-S07,
M15-S09,
M16-S07.

### Batch B3 — repairs, installs, and resets (12)

M01-S05,
M02-S09,
M07-S01, M07-S04, M07-S05, M07-S06, M07-S07, M07-S08, M07-S09, M07-S10,
M08-S07, M08-S08.

## Recording rules

- One evidence record per service, keyed by catalog service id.
- The record names the handler, the native command, the timestamp, the host,
  and the rendered text that proves stage 4.
- Exported artifacts (bundles, reports, backups) are recorded with their path,
  size, and SHA-256 prefix.
- A service that renders an explicit unavailable or refused state is not a pass
  unless the service contract says that state is the correct measurement.
- Batch results are merged as one change per batch, after typecheck, tests,
  `services:check`, and the runtime evidence regeneration pass.

## Infrastructure

The binary for this cycle is produced by `.github/workflows/verification-build.yml`
from the cycle commit. It is an unsigned debug build, uploaded as a
short-lived artifact, and it is not a release. Local MSVC and Windows SDK
components are absent on the cycle host, so the build runs on a Windows runner
instead of pretending a local link succeeded.

## Cycle 1 progress

### Merged before the runtime pass

- `main` @ `a5960d1` — fixed the blank production window: `lazyView` used a
  dynamic `import(variable)`, so Rollup emitted no view chunks; the helper now
  takes a statically analysable loader and the forced `views` manual chunk is gone.
- `main` @ `a5960d1` — localized the document shell (`/favicon.png`,
  `/fonts/fonts.css`); no remote font or icon reference remains.
- `main` @ `a5960d1` — the brand-gallery copied state resets after 1.8s.
- `main` @ `65960c8` — added the Tauri IPC origin `http://ipc.localhost` to the
  CSP `connect-src`. Without it every service invocation was blocked and the
  desktop window hung as "Not Responding". Also added a branded splashscreen
  window that closes once the main window mounts.

### Verified on the cycle host (commit `d1db4a6`)

- The splashscreen window opens on `splashscreen.html` and closes automatically;
  the main window is the only page target afterwards.
- No CSP errors are logged; the desktop runtime reports `Desktop runtime`.
- `M17-S01 Event log summary` was run through the UI: the click, the IPC round
  trip and the rendered result are all observed. It returned 3 event records.
  This is a pilot run, not a recorded evidence entry yet.

### Defect found and fixed in this cycle

**`powershell_command_failed` — ambiguous variable reference in two diagnostics scripts.**

Running a diagnostic section surfaced a PowerShell parser error:

```
Variable reference is not valid. ':' was not followed by a valid variable name
character. Consider using ${} to delimit the name.
```

The cause is that PowerShell reads `"$channel: ..."` as a scoped variable
reference, because `:` is the scope operator. The colon has to be outside the
variable name.

- `src-tauri/src/diagnostics/events.rs` — the Windows Event Intelligence query
  built its warning as `"$channel: $($_.Exception.Message)"`.
- `src-tauri/src/diagnostics/hardware.rs` — the hardware, driver and kernel
  warning query built its warning as `"$provider: $($_.Exception.Message)"`.

Both are now `"${channel}: ..."` and `"${provider}: ..."`. The braces are
doubled in the Rust source because the script is a `format!` literal.

This was reproduced locally against `powershell.exe` before the change (the
parser error above) and the corrected script was then executed on this host to
confirm it parses and returns real warnings instead of a parse failure.

The defect was found by reading the code of the failing command, not by
inspecting the rendered banner, and the fix is covered by a repository-wide
sweep: `$name:` no longer appears in any PowerShell string in the native
sources.

**`invalid type: map, expected a string` — the BSOD triage read a debugger path
out of a JSON object.**

The triage query failed on a host that has no Windows debugger installed. The
Rust envelope expects `debuggerPath` to be a path, but Windows PowerShell 5.1
serialises the result of

```powershell
Get-Command windbg.exe,kd.exe,cdb.exe -ErrorAction SilentlyContinue |
  Select-Object -First 1 -ExpandProperty Source
```

as `{}` when the pipeline is empty, not as `null`. An empty `PSObject` is
written as an empty JSON object, and a map cannot be read as a string, so the
whole triage failed and the BugCheck events it had already collected were lost.

The script now collects the sources into an array first and reads the first
entry, which keeps the value a string or `$null` in every interpreter:

```powershell
$debugger=$null
$debuggerSources=@(Get-Command windbg.exe,kd.exe,cdb.exe -ErrorAction SilentlyContinue | ForEach-Object { [string]$_.Source } | Where-Object { $_ -ne '' })
if($debuggerSources.Count -gt 0){$debugger=[string]$debuggerSources[0]}
```

Both shapes were produced on this host with `powershell.exe` 5.1 before the
change and after it: `{"debuggerPath":{}}` became `{"debuggerPath":null}` with no
debugger installed, and the path string was unchanged with one installed. The
Rust side also reads the field leniently, so a future shape change degrades the
result instead of failing the triage.

**`missing field 'installed_updates'` — the update query read a key the script
never wrote.**

The Windows Update analysis failed even though the query had worked. The script
writes the envelope key `installedUpdates`, but the Rust envelope had no
camelCase binding, so serde looked for `installed_updates`, found nothing, and
rejected the whole payload. The events and hotfixes that had been collected
were discarded with it.

Running the script on this host showed the data was there all along — 5 update
events and 11 installed hotfixes — so the service was reporting a contract
error while the measurement it was asked for was available.

The envelope now binds the camelCase key the script writes, the same way every
other diagnostics envelope already did.

Both defects are the same class: the native script and the Rust envelope that
reads it disagreed, and the disagreement destroyed a complete result. The fix
is covered by `src/tests/nativeJsonContract.test.ts`, which reads the native
sources and checks that every key a script writes has a matching field in the
envelope that reads it, and that no script expands a property that can be
empty.

**`powershell_json_invalid` — an empty result wrote no JSON at all.**

The Windows boot-history query failed on this host with

```
powershell_json_invalid:EOF while parsing a value at line 1 column 0:
```

The measurement itself was correct: this host has no Event 100 boot records.
The failure was in how the result was written.

Windows PowerShell 5.1 does not serialize a piped array the way it looks on
paper. Piping an **empty** array into `ConvertTo-Json` writes **nothing at
all**, and piping an array with **exactly one** element writes a bare object
instead of an array. Both were reproduced against `powershell.exe` 5.1:

| Piped expression | Output |
| --- | --- |
| `@() \| ConvertTo-Json` | *(no output at all)* |
| `@($one) \| ConvertTo-Json` | `{"a":1}` — an object, not an array |
| `@($two) \| ConvertTo-Json` | `[{"a":1},{"a":2}]` |

So a query that returned nothing produced unparseable output, and a query that
returned a single row produced the wrong shape. `ConvertTo-Json -InputObject`
keeps the array shape in every case, and that is the form used now:

```
ConvertTo-Json -InputObject @($result) -Depth 5 -Compress
```

This affected eight scripts: the five startup queries, the project runtime
query, the package check, and the developer port inventory. Only the boot
history query was visible, because it is the one whose result is legitimately
empty on a normal host. The others failed the same way on any host where the
measurement returned nothing or a single row.

One script collects into a `List[object]` rather than an array, and a `List`
has to be emitted with `ToArray()`, which the repository already required
elsewhere; that script now uses `ConvertTo-Json -InputObject $out.ToArray()`.

The boot history script is executed by the real interpreter in a native test
on the Windows runner, so the check holds against the PowerShell the
application actually uses, and
`src/tests/nativeJsonContract.test.ts` now refuses any script that pipes an
array into `ConvertTo-Json`.

**`EventLogException` — the boot history query died on a host without the log.**

The native test above caught a second failure on the Windows runner, which has
no `Microsoft-Windows-Diagnostics-Performance/Operational` log at all:

```
Get-WinEvent : The parameter is incorrect
FullyQualifiedErrorId : System.Diagnostics.Eventing.Reader.EventLogException
```

`Get-WinEvent` raises a **terminating** exception for a log that does not
exist, and `-ErrorAction SilentlyContinue` does not suppress it. The script
aborted before it wrote anything, so the empty-result defect above was only
one of the two ways this query could produce nothing.

The query is now guarded, the way the other event queries in the repository
already are, and the script writes an empty array on a host without the log
and a populated one on a host with it. Both were produced against
`powershell.exe` 5.1.

Every other `Get-WinEvent` in the native sources was checked for the same
exposure: the remaining ones read the `System` or `Application` log, which
always exist, or already sit inside a `try`/`catch` that turns a missing
channel into a reported warning.

**`Test-NetConnection` — the network query never came back.**

The network diagnostics query did not finish. It was measured at **48.8
seconds** on the cycle host, and it did not return at all within two minutes
on a filtered network. The user saw a diagnostic that stayed on "Reading…"
forever.

`Test-NetConnection` has no timeout of its own. It sends an ICMP echo and
waits for the reply to expire before it tries TCP, so on a host where the
echo is dropped the query is bound by the operating system's reply timeout,
not by anything the application controls.

The probe is now written against .NET directly, with an explicit timeout on
each part:

| Step | Bound |
| --- | --- |
| DNS resolution | the system resolver |
| ICMP probe | 3 s |
| TCP connect | 5 s |
| Route lookup | the CIM query that was already there |

The same measurement on the cycle host is now **52 ms** of ping round trip
and a successful TCP connect, with the source address and the interface
alias still reported, and the query is bounded at roughly 8 seconds instead
of running for a minute or more.

The reported `latencyMs` is the measured round trip rather than the total
time the probe happened to take, which is what the field claims to be.

The rest of the query is slower on this host for a reason outside the
application: `Get-NetIPConfiguration` and `Get-NetAdapter` are CIM queries
and take 15 to 30 seconds each here. The command is dispatched with
`spawn_blocking`, so the window stays responsive and shows the measurement
in progress rather than freezing.

### Observation recorded, not a defect
`M05-S09` is named "Change restoration" and owns `m05.restore.manage`. The
startup workspace also uses `m05.startup.change` to disable an entry, and that
primitive reports `m05_s09`. Disabling and restoring are the two directions of
one change, so the attribution is not false, but the service name reads as
restoration only. Renaming it to "Startup change & restoration" would describe
both directions. This is a wording refinement, not a false claim, so it is not
treated as a defect in this cycle.


