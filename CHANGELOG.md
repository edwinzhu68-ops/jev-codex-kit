# Changelog

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
