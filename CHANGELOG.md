# Changelog

## Unreleased

- Add `jev_prepare_work`: a shared packet for main-host execution and subagent handoff, preserving all originals, constraints, acceptance and review items. Reuse evidence validation and one bounded inference request; no automatic dispatch or model selection.
- Emit the zero-model `workflow` pre-work reminder for every eligible substantive prompt in a task, while short continuations and excluded prompts still skip the hook. Keep Jev judgments on demand and preserve the existing skill-routing mode.

## 0.4.2

- Default new automatic installations to a once-per-task local workflow hint: no prompt upload, credential startup or paid skill classification. Preserve legacy modes and decision history; add backed-up `auto mode workflow|skills` switching.
- Compact evidence text by merging repeated metadata without cutting retained originals, uncertainty, exclusions or checks. Keep full structured output and receipts compatible.
- Publish a bounded workload diagnostic, including unsuccessful source verification and a confounded Codex timing. No general speed or token-savings claim.

## 0.4.1

- Remove arbitrary 6/30 routing and 30 broker-call counters; uncertainty blocks only unchanged decisions, with legacy receipt/dedup migration.
- Record stale skills accurately; add explicit catalog refresh, task-specific status, disable/enable and owned-hook removal. Codex setup includes the automatic hook; upgrades back up skills.
- Resume long UI trajectories with bounded recent context; accept Chinese payloads under consistent character/UTF-8 envelopes; isolate simultaneous broker requests and startup ownership.
- Add the official Windows sky adapter with mandatory observe/inspect/action boundaries. Live native clicks remain unverified when accessibility is absent.
- Align BOM decoding in source briefs, allow explicit Lua/Luau evidence ranges, and document complete removal and current validation limits.

## 0.4.0

- Optional native Codex UserPromptSubmit hook, bounded routing, private receipts and quiet fail-open behavior; Windows shell-compatible launcher.
- CUA UI session for fresh observed clicks and browser scrolling, with independent final verification and host handoffs.
- Local authenticated API-only broker for the restricted CUA import runtime; no alternative browser driver or plaintext API key.
- Codex UI skill and explicit desktop/browser/source-integration evidence boundaries.

## 0.3.0

- Add `jev_route_skills`, available through the same MCP, Pi and CLI interfaces.
- Preserve required skills without inference; explicit no-match, uncertainty and disabled-candidate handling. No automatic skill loading or session interception.
- Offline direct-directory skill metadata export with YAML parsing and full-file hashes; CLI validates catalog freshness before and after inference.
- Bounded one-request routing (19 candidates / 20 questions / 24000 serialized characters), with independent applicability checks and private receipts.
- Reproducible eight-case bilingual diagnostic suite, lexical baseline and first live report; no end-to-end speedup claim.

## 0.2.0

- Display name Jev Coding Kit; repository/package identifiers remain compatible.
- Client selection for Claude Code, Cursor, OpenCode, Pi and VS Code alongside Codex.
- Native Pi adapter shares the same 11-tool server; `/jev-status` checks connection without inference.
- JSONC-preserving client configuration, conflict preflight and backups of changed existing files.
- Custom kit storage propagated into registrations; client-specific config exports without keys.
- Client installation/upgrade/removal guide, contribution guide, issue and PR templates.
- Seven additional client/adapter regression tests. Compatibility limits remain explicit.

## 0.1.0

- Portable CLI, Codex registration and shared skill.
- Nine upstream judgment tools and two scoped evidence/source tools.
- Bounded fixed-model inference, source hashes and uncertainty preservation.
- Windows DPAPI / Unix permission-restricted credential storage.
