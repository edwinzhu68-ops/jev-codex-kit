# Automatic, quiet Codex skill routing

The native `UserPromptSubmit` hook starts on normal user messages. Codex setup
installs it together with the two dedicated skills. It can be disabled. After
one-time setup and native Codex trust, users do not name Jev, start a terminal,
or manually run a router for each task. Jev recommends a skill; Codex still owns
reading the skill, execution, evidence gathering and acceptance. This does not
turn Jev into a code generator or autonomous executor.

## Setup

Use Node 22+ and a Codex version supporting `UserPromptSubmit` (the integration
was developed against CLI 0.153.4). Normal `setup --root PATH --client codex`
installs a new hook with the coding and UI skills. For an existing custom catalog,
keep its selected scope; `setup --upgrade` refreshes its selected skill pins.
To install the hook separately, create a local specification containing only
authorized project roots and the explicit installed skills you want considered:

```json
{
  "roots": ["/absolute/path/to/project"],
  "skill_files": ["/absolute/path/to/skills/jev-codex-kit/SKILL.md"]
}
```

On Windows use absolute paths with `/` or JSON-escaped `\\`. Then run once:

```sh
node bin/jev-kit.mjs auto install /absolute/path/to/spec.json
```

The installer preserves unrelated hooks and backs up an existing `hooks.json`.
Windows uses a hidden PowerShell launcher with encoded, quoted arguments so it
works when Codex's configured command shell is itself PowerShell.
It pins selected skill bytes in `~/.jev-codex-kit/auto/config.json` (or
`JEV_KIT_HOME`). It writes a command hook in `CODEX_HOME/hooks.json`, defaulting
to `~/.codex/hooks.json`. It never edits hook trust, grants shell permissions,
changes model providers or restarts existing sessions.

Review and trust this exact command in Codex's native hooks UI (`/hooks` in the
CLI). Codex skips new or changed untrusted hook definitions. Installed is not
active. Desktop builds can lag the CLI; a CLI check cannot prove an already
running Desktop task loaded the hook. Check an actual next-task hook receipt.

## Runtime contract

- Eligible current prompt plus full descriptions of 1-19 selected skills goes to
  TypeSafe. No transcript, skill body, repository source, or arbitrary directory
  scan is sent. This is a curated candidate scope, not the client's full registry.
- Empty input, common continuation/confirmation/stop messages, arithmetic-only input,
  code blocks, prompts over 1,800 characters, and common sensitive patterns skip
  locally. Pattern filtering is not a guarantee of personal-data removal; enable
  only in projects where sending eligible task descriptions is authorized.
- Current task context stays with Codex. A standalone prompt is not the whole
  conversation; this hook cannot resolve all ambiguous follow-ups. Recommendations
  never override explicit required skills or project restrictions.
- One workflow request per eligible new prompt/catalog combination. There is no
  six-per-task or thirty-per-day counter. Those v0.4.0 numbers were local policy,
  not provider quotas. Attempted unchanged judgments are not replayed. Legacy
  attempted prompt hashes remain blocked during migration; old receipts survive.
  SDK transport retries may occur within the deadline, so one workflow is not
  an exact HTTP-request or billing guarantee.
- Five-second inference timeout, eight-second handler watchdog, twelve-second
  native hook deadline. SDK/credential startup adds overhead; no zero-latency or
  end-to-end speedup claim is made. Concurrent handlers in the same task skip;
  separate tasks use separate locks and decision records.
- Failure or uncertainty affects that unchanged decision, not the whole task/day.
  If an uncertain result names a valid candidate, the host receives an explicit
  REVIEW_REQUIRED advisory to inspect it, not an accepted skill recommendation.
  No-match without a candidate and errors do not inject a made-up selection.
  Codex continues. No match emits nothing. Changed skill bytes record STALE_SKILLS
  and emit no suggestion until an explicit `auto refresh`; a previous SUGGESTED
  result is not left as the latest status after a stale-skill attempt.
- Normal operation emits no chat message, warning, terminal window or error text.
  A selected skill is passed as a compact developer-context advisory containing
  only its opaque ID and the local config pointer. Codex may still display native
  hook/tool activity; its `suppressOutput` is currently not implemented.
- Automatic routing does not guarantee that the host invokes a recommended skill
  or follows every judgment. The host must check its real tool/skill registry.

## Inspect and disable

`node bin/jev-kit.mjs auto status` reads the latest private status without a model
call. `NO_OBSERVED_RUN` means no eligible invocation was observed, not success.
Use `auto status --session ID` for one task; the default is latest across tasks.
Local `auto/receipts` stores the eligible prompt, candidate metadata and raw model
result for audit. Keep it private; do not commit it. `last-run.json` stores only
hashed prompt/session identifiers, status, timing and usage.

`auto disable` pauses this router locally; `auto enable` enables it without
changing pinned skill hashes. After reviewing an updated skill, run `auto refresh`
to back up the config and accept its new bytes. Neither operation grants native
hook trust or clears decision history. `auto uninstall` backs up hooks.json and
removes only the exact owned group, refusing a modified command. Other hooks,
credentials and receipts stay intact. Full removal: [clients.md](clients.md).
A forced termination can leave `auto/sessions/<session-hash>.lock`; confirm no
handler for that task is running before removing that exact empty directory.

This automatic hook is Codex-specific. Other clients retain their documented MCP
or Pi integration; this release does not claim equivalent automatic interception
in Claude Code, Cursor, Pi or OpenCode.

Sources: [official hooks guide](https://developers.openai.com/codex/hooks),
[Codex 0.153.4 submit-event implementation](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/hooks/src/events/user_prompt_submit.rs).
