# Validation record

## Unreleased source update: pre-work reminder — 2026-09-22

- The global Codex rule now requires a zero-model, purpose-based Jev preflight before each new substantive task or independent work package. It preserves on-demand calls and excludes deterministic work and repeat judgments.
- The existing trusted `UserPromptSubmit` hook command and installed `workflow` mode were retained. Its handler now returns the local pre-work reminder on each eligible substantive prompt in the same task: first `WORKFLOW_HINT`, then `WORKFLOW_REMINDER`. Short continuations and excluded/sensitive prompts still skip locally; global instructions carry the work-package rule.
- A direct invocation of the current installed handler and config for one synthetic session with two distinct eligible work prompts returned `UserPromptSubmit` additional context twice. The second status was `WORKFLOW_REMINDER`, `model: null`, `workflow_inference_calls: 0`, `question_count: 0`. This verifies the handler path, not a new Desktop model turn or every already-running task's refresh.
- Affected hook tests: 16/16 PASS. Full local kit suite after the batch: 81/81 PASS. No Jev API request, model/provider change, restart, or hook trust change was required for this validation.

Release candidate 0.4.2. No blanket claims about speed, savings or semantic accuracy.

- Windows suite: **81/81 PASS**; after deferring the unused provider import, the affected hook/router/entry suites passed **32/32**. The original local companion passed **20/20**. CI for the release commit determines Linux/macOS results.
- Real native Codex app-server hook -> local receiving model fixture: **PASS**. The unchanged trusted hook emitted `WORKFLOW_HINT`, `model: null`, zero inference/questions. Its observed Windows hook duration was 1,859 ms: this is not zero local overhead. No real generative provider was used by this transport check. Existing Desktop tasks were not restarted or proven refreshed.
- The installed original companion launcher returned `jev-evidence-text-v1` through actual stdio MCP with both tools present, two complete pinned originals/hashes, no stderr and zero inference. Full structured results remain compatible. Existing long-lived processes may still emit the previous text layout.
- Workload diagnostic: Chinese report classification **8/8 in 685 ms** observed call time; source verification **3/8 exact labels**, including three direction errors and seven review/escalation items. The Codex classification baseline incurred a hook-induced config read, so its timing cannot establish a fair speed ratio. Full [method and limits](docs/evaluations/workload-benefit-20260922.md).
- Offline presentation of that recorded response retained all originals and judgments while reducing text from **8,769 to 4,887 characters**. The whole serialized MCP result, including the unchanged structured contract, fell from **18,454 to 14,254 characters**. Character reduction is not a measured token or billing saving.

Historical v0.4.1 evidence:

- Final Windows full suite: **77/77 PASS**. A concurrent status-write test exposed Windows rename contention; task receipts now remain authoritative and the status command selects complete per-task records. The affected suites passed **23/23**, then the full suite passed. See release-commit CI for other platforms.
- Regression coverage includes 42 distinct prompts despite old 6/30 counters; 40 real HTTP loopback actions across five chunks; two simultaneous tasks; Chinese payloads above 24 KB but within the character contract; stale-skill refresh; preserved legacy dedup; BOM source discovery; Lua/Luau ranges; backed-up skill upgrade/removal; idle shutdown and simultaneous broker launches.
- Actual in-app browser + real Jev on the final reused parser/candidate code: **PASS**, two clicks / three decisions, **1,602 ms** loop, **1,070 ms** API total, 2,077 input / 141 output tokens. Independent final readback showed Report details open and Revenue 42; status ready. Disposable local fixture only.
- Real Codex submit hook ran with an unchanged trusted command: Jev selected UI with probability 1 but applicability .86 below the .9 threshold, so the probe returned REVIEW_REQUIRED. This is not an accepted recommendation. The final fix explicitly relays such a selected candidate as review evidence; offline tests verify that contract without lowering thresholds or rerolling the failed decision. The receiving model endpoint was a local fixture, not a real generative Codex task.
- Windows Computer Use adapter is implemented and contract-tested. The installed official sky plugin returned Calculator's window but no accessibility tree; Notepad had no targetable window. **A real Jev-selected Windows click is NOT VERIFIED.** macOS native execution and general coding speed/usage improvements are also unverified.
- Source reuse: unchanged jev-browser-use bridge supplies browser candidates; Jev-cu supplies unchanged parseAX/role definitions. Licenses and pinned revisions are retained. Their broad execution entry points and benchmark results are not claimed as this kit's behavior.
- One bounded Jev gate on the earlier hook/broker patch verified three scoped claims but returned overall `escalate` (`review_escalated`). It is not recorded as an automatic review pass. Host inspection and additional concurrency/lifecycle regressions followed, including the Windows status-write repair above; no threshold was relaxed and the same gate was not rerolled.

Historical v0.4.0 evidence (the native-API claim below was corrected by the audit above):

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
