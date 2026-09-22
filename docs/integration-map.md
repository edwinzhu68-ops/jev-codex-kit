# Integration map and current evidence

The kit combines useful mechanisms, not every repository or every advertised
speedup. This table distinguishes shipped behavior from research and limitations.

| Source | Useful mechanism | Kit implementation / limitation |
| --- | --- | --- |
| [burnigtm/jev-mcp](https://github.com/burnigtm/jev-mcp) | Typed route/review/verify/gate judgments | Nine existing tools; host retains execution and acceptance |
| [tonyzdev/pijev](https://github.com/tonyzdev/pijev) | Scope source discovery and semantic ranking | Existing `jev_code_brief`, hashes and full selected source units |
| [lomeshdutta/skill-router](https://github.com/lomeshdutta/skill-router) | Match goals to installed skills, allow no match | Existing bounded router plus optional native Codex submit hook |
| [Sac-Y/Jev-cu](https://github.com/Sac-Y/Jev-cu/tree/52d32ac24e2cea29c63d9d7c4bd6d4c401111f56) | Codex binds/reads/acts; Jev selects from AX controls inside a loop | New bound-target UI loop; desktop adapter contract tested, real native execution BLOCKED in this session |
| [wy-coliney/jev-browser-use](https://github.com/wy-coliney/jev-browser-use/tree/f14b60e0ae1ee90cd73eb6650e30a666a84c021a) | Keep loop inside existing CUA connection; preserve history and return to host | New `createBrokerSession`, unique observed controls, stale-state checks, host typing/verification |
| [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast/tree/1231850a0bf1a0c0341fe408ef1668dbbfdfac46) | Indexed action space, one decision request per cycle, separate writing and execution | One Choice over already authorized action/target pairs; no extra Chrome/CDP profile or text-model account installed |
| [NiazMorshed2007/jev-review](https://github.com/NiazMorshed2007/jev-review) | Evidence-based code feedback | Existing review/gate retained; no duplicate mandatory second reviewer installed |
| [tamaratran/fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) | Preserve important original material | Existing pinned evidence and counterevidence retained; native conversation compaction is NOT replaced |
| [iammrduncan/typesafe-ai-benchmark](https://github.com/iammrduncan/typesafe-ai-benchmark) | Reproducible measurements and explicit limits | Existing frozen bilingual skill diagnostic plus current UI integration checks; no borrowed speed ratio |

The user's linked Calendar demo corresponds to **Sac-Y/Jev-cu**, not the unrelated
`shitianfang/jev-use` or `savka777/jev-use`. Current Jev-cu expects a bound Codex
Computer Use runtime, offers `runTask`/`createCuaDriver`, and defaults to dry-run.
It is not a background replacement for the whole Codex reasoning engine. Its
macOS app names and platform-specific actions cannot simply be declared working
on Windows. We did not import its broad app allowlist or treat Calendar/Figma as
automatically free of side effects.

## Quiet automatic entry

Follow [automatic Codex setup](automatic-codex.md). The submit hook can recommend
the UI skill; the host starts its API broker without another user launch. Existing
ongoing tasks still require actual hook/skill refresh evidence. The host checks
real tool availability, task permissions and data scope before UI actions.

`node bin/jev-kit.mjs ui install` installs the Codex UI skill without changing old
MCP servers. Normal Codex setup also installs it. `ui start` is an agent-side
fallback for an expired broker; users do not need to run it per task. Include the
installed `jev-ui/SKILL.md` in the auto install specification to consider it.

Browser clicks, tabs, checkbox toggles and bounded scrolls use current observed
targets. Typing, images, canvas and unsupported widgets return to Codex's normal
CUA tools; the same session may resume after the host checks the new state.
There is no claim that every browser action or every client is implemented.

The loopback broker exists because the CUA import runtime rejected npm package
resolution and process access in the current app. It only handles typed API
judgments; all UI operations stay in CUA. It uses the existing encrypted Windows
credential, a random local access token, a ten-minute lifetime and thirty-request
cap. No key is returned to the browser or stored in the repository.

## Actual checks on 2026-09-22

- Native Codex CLI/app-server 0.153.4: ordinary `UserPromptSubmit` triggered the
  installed hook; a real Jev result reached the next model input. The receiving
  model endpoint was a local fixture (no generative model API charge). Hook
  completed in 2,805 ms; Jev route time 667 ms. This is native transport evidence,
  not proof that every currently open Desktop task refreshed configuration.
- Real Codex in-app browser + real Jev: one CUA invocation performed two clicks,
  Reports then Details, and returned NEEDS_VERIFICATION after three decisions.
  Loop 1,729 ms; API total 1,044 ms; 2,111 input and 141 output tokens. Independent
  AX readback showed `Report details open` and `revenue 42, status ready`.
- UI test was a disposable local page, no account or production side effect.
  It is not a benchmark against Codex, a general website reliability result,
  a desktop Calendar test, or proof of a 5-10x improvement.
- Native desktop: simulated adapter tests only. The current tool declaration
  disables native computer APIs, so real Windows/macOS application execution is
  BLOCKED. No alternate native driver was installed to bypass that constraint.
- Quiet means no added console window/chat announcement. Codex can still display
  hook/tool activity. Windows native UI, where available, may activate windows;
  do not promise invisible desktop interaction.
