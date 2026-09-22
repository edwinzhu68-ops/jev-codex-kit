# Validation record

Release candidate 0.4.0. No blanket claims about speed, savings or semantic accuracy.

- Local Windows: **62/62 PASS**. Adds hook installation/preservation, Windows PowerShell launch regression, canonical project paths and junction-escape checks, routing budgets, quiet error paths, real loopback broker authorization checks, stale UI decisions, bounded browser scrolling and native adapter contract tests.
- Actual Codex 0.153.4 hook -> real Jev -> next model input: PASS, including selection of the installed `jev-ui` skill (605 ms model route, 2,952 ms hook). Generative endpoint was a local fixture. Existing Desktop task refresh was NOT VERIFIED.
- Actual CUA in-app browser -> real Jev -> two real clicks -> independent final AX readback: PASS. Three decisions, 1,729 ms loop, 2,111 input / 141 output tokens. See `docs/integration-map.md`.
- Real native desktop Computer Use: BLOCKED by the current tool surface; simulated contract checks are not native execution evidence. Browser scroll has automated contract coverage but no live scroll benchmark.
- Integration fixes: quoted Windows executable needed an explicit PowerShell invocation; CUA rejected npm/process access, so an authenticated API-only loopback broker was added. Starting that daemon inside the native submit hook timed out; the host now starts/reuses it automatically after skill routing instead. A fresh native UI-routing test passed after this correction.

Historical v0.3.0 evidence:

- Current local Windows suite: **44/44 PASS**, including real MCP registration of all 12 tools, required-skill zero-inference behavior, offline catalog CLI, stale catalog and overwrite rejection, schema/secret/request limits, uncertainty and failed-response handling.
- Live skill-routing diagnostic: eight distinct synthetic tasks, fixed four-skill catalog, `jev-1.13.0`, expected result 8/8 versus lexical baseline 6/8; 2216 ms summed route time. Raw report, dataset, methodology and explicit limits are in `docs/evaluations/skill-routing-20260922.md`. No Codex workload/token reduction or coding-task speed comparison was measured.

Historical v0.2.0 evidence:

- Current local Windows suite: **33/33 PASS**, including the final local release check. New cases cover client dialects, secret-free config export, JSONC preservation/backups, conflict preflight, scoped installation paths and the Pi adapter using an actual MCP subprocess. See the release commit CI for platform results.
- Real Claude Code 2.1.172 (`mcp get`) and OpenCode 1.18.14 (`mcp list`) connected to the generated registrations in isolated config directories. No paid model task was run and existing client registrations were not edited.
- Client registration tests do not prove each desktop client's behavior. The current matrix in docs/clients.md states what was and was not tested. macOS Finder launch is not verified by shell/Node CI.

Historical v0.1.0 evidence:

- Final local Windows suite: **26/26 PASS**, including DPAPI, actual stdio and CLI. A real Codex CLI was also registered twice successfully in an isolated user/config home; other registrations were not changed.
- One bounded live call through the distributed CLI used public synthetic text stating a test was not run. `jev-1.13.0` returned Noul .02 for successful execution, complete coverage, 292 input / 20 output tokens. This is a connection/one-case check, not general accuracy evidence. No credential or local receipt is included in the repository.
- Packaging check: the npm archive includes built vendor modules and third-party licenses, without node_modules, credential stores or private receipt folders. Release ZIP includes source and lockfile and requires the documented install/build step.

- Original companion checks: 20 passed on Windows after portability changes. These include actual source discovery, source hashes, complete-unit extraction, stale files, path/junction rejection, uncertain evidence retention and stubbed model responses.
- Unified entry checks: actual CLI setup/config/doctor, no-key deterministic evidence, overwrite refusal, unauthorized roots, actual stdio registration of all 11 tools, model override and request bounds. See CI for the final test count and per-platform results.
- Credential test uses a fake value in an isolated home; Windows must roundtrip DPAPI without storing plaintext. It never calls the network.
- `npm run build` transpiles vendored modules, not a claim of full upstream type checking. Upstream full test suites are not included or claimed passing; previously observed upstream Windows portability failures remain outside this kit's focused test result.
- A source brief is partial evidence. Chinese/GDScript semantic accuracy, real game-task speed, other MCP desktop clients and autonomous programming are not accepted by these checks.

Use the GitHub Actions run associated with the release commit for current Windows/Linux/macOS results. CI runs without API secrets. Local doctor is offline and cannot validate API authentication.
