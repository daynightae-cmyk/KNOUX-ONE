# Web deployment provenance

KNOUX ONE is a Windows desktop application. This file records what the browser deployment
is, because until now nothing in the repository said so and the deployment was not
reproducible from a commit.

## What the web deployment is

`knoux-one.vercel.app` serves the Vite build of `dist/` — the renderer only.

It is **not** the product. Every native Windows operation is unavailable in the browser,
and the application says so in the interface rather than simulating a result: browser
preview returns `desktop_runtime_unavailable` and no host reading is ever fabricated.
The authoritative build is the signed Windows package produced by `release.yml` from a
`v*` tag. The two are not interchangeable and this file does not claim the web build is
a substitute for it.

## Why this file exists

The Vercel project is GitHub-integrated, but nothing in the repository declared how the
web build is produced, so the served bundle could not be traced to a commit. Measured on
2026-10-01:

| Bundle | Bytes |
|---|---|
| Served by `knoux-one.vercel.app` | `index-Cs8-2bVN.js`, 1,035,705 |
| Clean build of `main` @ `498c4b0` in a fresh worktree | `index-Dcgd3Kw9.js`, 1,006,299 |

The clean build was reproduced twice — once in the working tree, once in a detached
worktree at `498c4b0` with `bun install --frozen-lockfile` — and both produced
`index-Dcgd3Kw9.js` at 1,006,299 bytes. The CSS was byte-identical in every case. So the
served JavaScript is not what this repository builds at `main`.

The GitHub deployments API does show a `Production` deployment for `498c4b0` created
2026-09-27T18:45:48Z, so a deployment was made from that commit. It is not what the
production alias serves now: the alias carried `Last-Modified: 2026-10-01T02:38:54Z`,
about five hours before the `main` deployment and with no matching entry in the
deployments list. Something redeployed production that this repository cannot account
for.

`vercel.json` now pins the framework, build command, install command and output
directory, so the next deployment is defined by the repository rather than by whatever
was configured in the dashboard.

## Verifying a deployment

A deployment is only traceable if the served bundle matches a build of a known commit.
Build and compare:

```bash
bun install --frozen-lockfile
bun run build
cat dist/index.html          # the asset filenames are content hashes
```

Then fetch `https://knoux-one.vercel.app/` and compare its `assets/index-*.js` filename
and `Content-Length` against `dist/index.html` and `dist/assets/`.

If they differ, the deployment did not come from the commit you just built. Find the
actual commit before trusting the live site as evidence of anything.

## What the live site may and may not be cited for

| Claim | Allowed |
|---|---|
| The renderer builds and loads without console errors | yes |
| Browser preview keeps native operations disabled | yes |
| The service-reality counts the interface renders | only as the **baseline** states them, never as runtime proof |
| Any service works on Windows | **no** — that is `RUNTIME_VERIFIED` evidence in `docs/evidence/windows-runtime-evidence.json`, and the global gate is BLOCKED |

## Recording a deployment

When a deployment is made, add a row below with the commit, the bundle hash and the date.
An unrecorded deployment is treated as unverified, because that is what it was.

| Date | Commit | JS bundle | Note |
|---|---|---|---|
| 2026-09-27T18:45:48Z | `498c4b0` | unknown (URL protected) | GitHub `Production` deployment. Not the bundle the alias serves. |
| 2026-10-01T02:38:54Z | unknown | `index-Cs8-2bVN.js` (1,035,705 B) | Served by the alias. No matching deployment record. Treated as unverified. |

## Deployment protection is on

Both per-deployment URLs (`knoux-7qsptv6wv-…`, `knoux-psiiydqdm-…`) return a Vercel login
page rather than the app. Only the production alias is public. That is a reasonable
default, but it means the bundle behind a specific commit cannot be fetched without
credentials, so the verification procedure above works only against the alias.