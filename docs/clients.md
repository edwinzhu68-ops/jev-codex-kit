# Client setup / 客户端安装

Requires Node.js 22+, ripgrep and a built checkout (`npm ci --ignore-scripts`, then `npm run build`). Semantic judgments require your own TypeSafe key. Keep this installation directory after registration.

```sh
node bin/jev-kit.mjs setup --root "/absolute/project" --client claude,cursor
node bin/jev-kit.mjs doctor
```

选择 `codex`、`claude`、`cursor`、`opencode`、`pi` 或 `vscode`，可用逗号分隔。`--client none` 只授权项目和配置凭据。Windows 使用 `setup.cmd`；macOS/Linux 使用 `sh setup.sh`。macOS 的 `setup.command` 是辅助入口，尚未验证 Finder 双击体验。

| Client | Installation target | Verification boundary |
| --- | --- | --- |
| Codex | Actual `codex mcp add`; dedicated `~/.agents/skills/jev-codex-kit` | v0.1 isolated real CLI registration; current protocol covered by tests |
| Claude Code | `~/.claude.json` MCP; `~/.claude/skills/jev-codex-kit` | 2.1.172 real CLI reports Connected in isolated config; no model task claimed |
| Cursor | `~/.cursor/mcp.json`; `~/.cursor/skills/jev-codex-kit` | JSONC merge/config tests; GUI not tested |
| OpenCode | `~/.config/opencode/opencode.json[c]`; adjacent skills | 1.18.14 real `mcp list` reports connected in isolated config; no model task claimed |
| Pi | `~/.pi/agent/extensions/jev-kit.ts`; adjacent skills | Native adapter harness calls real MCP; actual Pi session not yet tested |
| VS Code | Selected project `.vscode/mcp.json` and `.github/skills/jev-codex-kit` | Config tests; GUI not tested |
| Windsurf / other MCP hosts | `config --client windsurf` / `generic` export only | Manual adaptation; not advertised as verified integration |

The installer honors `CLAUDE_CONFIG_DIR`, `OPENCODE_CONFIG_DIR`/`XDG_CONFIG_HOME`, and `PI_CODING_AGENT_DIR`. Both OpenCode JSON and JSONC present is treated as ambiguous and requires manual merge. A custom `JEV_KIT_HOME` is bound into generated registrations. Exported settings never contain the API key.

## First use / 首次使用

Reload the selected client's tools or start a fresh task; trust/enable the server if that client asks. Existing running tasks do not necessarily discover newly registered tools.

> 使用 jev-codex-kit 技能。先确认有哪些工具；针对本任务按需定位源码、整理证据和核对结论。你负责编辑和实际测试，不要每条消息都调用 Jev。

Pi provides `/jev-status`: it starts the local MCP connection and lists tools without calling a model. Other clients can inspect their MCP tool list (11 tools). This proves connectivity only. For a reproducible no-key evidence call, edit `examples/evidence.json` to point at an authorized non-sensitive file; keep sources pinned and omit labels/checks. Then run:

```sh
node bin/jev-kit.mjs call jev_prepare_evidence examples/evidence.json new-result.json
```

Review source hashes and coverage. Readiness is not a code review pass. Semantic calls may use paid quota; no demo shares a maintainer key.

## Upgrade and conflicts / 升级与冲突

Prefer updating/building in the existing installation location. Before changing versions, retain the previous checkout or release ZIP. Same-name MCP entries pointing elsewhere are never overwritten: export `config --client CLIENT` and merge the one `jev-kit` entry after checking your old installation. No automatic deletion or migration of older Jev services occurs.

Non-Codex config edits preserve unrelated JSONC content and create adjacent `.jev-kit-backup-*` files. Only kit-marked skill/extension files can be updated automatically, with a backup; keep personal instructions elsewhere. Codex preserves a differing existing skill and asks for manual installation. Multi-file installation is preflighted but is not an atomic transaction: if interrupted, inspect listed targets and rerun after resolving the error.

VS Code project files contain machine-specific absolute paths. Review before committing them; prefer local exclusion if they are not intended for collaborators. Do not upload config backups: they can contain unrelated client settings.

## Troubleshooting and removal / 排错与卸载

- `SETUP_REQUIRED`: inspect `doctor` fields for build, key, ripgrep and authorized paths. It makes zero network requests.
- Missing tools: confirm the client loaded the generated entry; keep the install folder in place. No need to stop unrelated sessions.
- Different `jev-kit` entry: inspect and merge, rather than deleting all MCP settings.
- API failure or incomplete coverage: no approval is granted. Fix the stated prerequisite or continue using local tools; do not reroll the same judgment.
- Uninstall Codex: `codex mcp remove jev-kit`. For other MCP clients remove only the `jev-kit` object from the target above. For Pi remove only `extensions/jev-kit.ts`. Remove the dedicated `jev-codex-kit` skill if no longer needed. Retain `~/.jev-codex-kit` if credentials or receipts are still needed. Existing alternative Jev installations are independent.

Official references: [Claude MCP](https://code.claude.com/docs/en/mcp), [Cursor MCP](https://cursor.com/docs/mcp), [OpenCode MCP](https://opencode.ai/docs/mcp-servers/), [Pi extensions](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md), [VS Code MCP](https://code.visualstudio.com/docs/agent-customization/mcp-servers).
