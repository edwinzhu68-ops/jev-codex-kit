# Validation record

Release candidate 0.1.0. No blanket claims about speed, savings or semantic accuracy.

- Final local Windows suite: **26/26 PASS**, including DPAPI, actual stdio and CLI. A real Codex CLI was also registered twice successfully in an isolated user/config home; other registrations were not changed.
- One bounded live call through the distributed CLI used public synthetic text stating a test was not run. `jev-1.13.0` returned Noul .02 for successful execution, complete coverage, 292 input / 20 output tokens. This is a connection/one-case check, not general accuracy evidence. No credential or local receipt is included in the repository.
- Packaging check: the npm archive includes built vendor modules and third-party licenses, without node_modules, credential stores or private receipt folders. Release ZIP includes source and lockfile and requires the documented install/build step.

- Original companion checks: 20 passed on Windows after portability changes. These include actual source discovery, source hashes, complete-unit extraction, stale files, path/junction rejection, uncertain evidence retention and stubbed model responses.
- Unified entry checks: actual CLI setup/config/doctor, no-key deterministic evidence, overwrite refusal, unauthorized roots, actual stdio registration of all 11 tools, model override and request bounds. See CI for the final test count and per-platform results.
- Credential test uses a fake value in an isolated home; Windows must roundtrip DPAPI without storing plaintext. It never calls the network.
- `npm run build` transpiles vendored modules, not a claim of full upstream type checking. Upstream full test suites are not included or claimed passing; previously observed upstream Windows portability failures remain outside this kit's focused test result.
- A source brief is partial evidence. Chinese/GDScript semantic accuracy, real game-task speed, other MCP desktop clients and autonomous programming are not accepted by these checks.

Use the GitHub Actions run associated with the release commit for current Windows/Linux/macOS results. CI runs without API secrets. Local doctor is offline and cannot validate API authentication.
