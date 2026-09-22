# Jev Codex Kit

One portable CLI and stdio MCP server for nine Jev judgment tools plus scoped source discovery and evidence preparation. Community integration, not an official TypeSafe or OpenAI product. Jev judges; your coding host edits, executes and verifies. No universal speedup or cost savings claimed.

## Install

Requirements: Node.js 22+, ripgrep (`rg`), your own TypeSafe API key, and the Codex CLI for automatic registration.

Download the release ZIP or clone this repository, then run:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run setup -- --root "/absolute/project/path" --codex
npm run doctor
```

The setup prompt hides your key. Windows uses current-user DPAPI; macOS/Linux use an unencrypted mode-0600 file in `~/.jev-codex-kit`. Alternatively set `TYPESAFE_API_KEY` in the environment inherited by your MCP host. API usage can cost money; no shared credentials are included. Keep the installation folder after registration.

Setup adds only the `jev-kit` MCP entry and dedicated skill. It preserves other entries and refuses conflicting same-name configuration. Config and source-bearing receipts stay outside the repository. Use `JEV_KIT_HOME` consistently in both setup and the MCP host if overriding the storage directory. Doctor is offline; READY is not a live API or semantic quality result.

## Use

Ask your host to use the installed `jev-codex-kit` skill when relevant. Do exact searches and arithmetic locally. Use `jev_code_brief` for scoped source discovery, `jev_prepare_evidence` for explicit source/log collection, and original `jev_*` tools for judgments. No every-message calls, repeated judgments or automatic model switching. The host retains authorization, execution and acceptance responsibilities.

For any MCP client, `node bin/jev-kit.mjs config` prints a credentials-free config to adapt to that client's settings. If a current session lacks the MCP tools, use the same CLI:

```sh
node bin/jev-kit.mjs call jev_prepare_evidence examples/evidence.json new-result.json
```

Edit the example's root and file paths first. Existing output files are refused before inference. Pinned collection without labels/checks needs no model. Add another authorized root with `setup --root PATH --no-key-prompt`.

## Boundaries

Pinned `jev-1.13.0`; inference boundary enforces 20 questions and 24000 serialized characters. Incomplete/truncated results are errors. SDK transient HTTP retries may occur within its deadline. The kit does not reroll judgments.

Source brief: explicit authorized subdirectory, at most 256 files/2 MiB scanned, 256 KiB per file, 8 candidates; complete JS/TS/GDScript units up to 4500 characters or whole small files up to 2400. Lua/Luau/Python support only whole small files. Evidence: explicit files/ranges/GDScript functions, 10 sources, 8 checks, 2 MiB per file, shared request caps. Neither tool establishes full-repository coverage.

`auto`, `BRIEF_READY` and `EVIDENCE_READY` are advisory, not permission or runtime acceptance. Secret checks are best effort; source hashes are point-in-time checks, not locks. Do not send secrets, personal data, real saves or entire repositories. See [SECURITY.md](SECURITY.md).

`npm test` uses local files, actual stdio/CLI and stubbed judgments without paid API requests. See [VALIDATION.md](VALIDATION.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). No autonomous executor or Foreman/JevLoop integration. Remove with `codex mcp remove jev-kit` and delete only the dedicated skill folder; preserve local receipts as needed.
