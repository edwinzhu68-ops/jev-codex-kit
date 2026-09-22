# Skill routing / 按任务选择技能

Use this when a clear task could benefit from a skill but the best candidate is uncertain. Explicitly requested or mandatory skills must be handled directly by the host. Do not classify every message, confirmation or tool receipt.

## MCP and Pi

`jev_route_skills` is the twelfth tool on the same `jev-kit` server and native Pi bridge. Supply complete descriptions from the client's actual available-skills registry:

```json
{
  "goal": "Review this diff for regressions without changing files",
  "candidates": [
    {"id":"review","name":"Patch review","description":"Inspect a proposed source-code diff for correctness bugs and regressions. Read-only."},
    {"id":"charts","name":"CSV charts","description":"Create exportable labelled charts from CSV measurements."}
  ],
  "required_ids": []
}
```

The same JSON works with `node bin/jev-kit.mjs call jev_route_skills INPUT.json NEW_RESULT.json`. At most 19 candidates and 20 questions per inference: one Choice including `none`, plus an independent applicability Noul per enabled candidate. The selected candidate itself must meet the applicability threshold. Complete serialized requests must fit 24000 characters; overflows fail without truncation. Thresholds are explicit conservative starting values in `src/skill-router.mjs`, not calibrated guarantees.

| Status | Host behavior |
| --- | --- |
| `REQUIRED_SKILLS` | Preserve all supplied required skills; zero inference. Host loads them under its existing rules. |
| `SUGGESTED` | Inspect the suggested skill and confirm its applicability/availability before loading. |
| `NO_MATCH` | None of these supplied enabled candidates clearly fits. This says nothing about omitted skills. |
| `EMPTY_CATALOG` | No enabled candidates; zero inference. Not evidence that no useful skill exists. |
| `REVIEW_REQUIRED` | Inconclusive or inconsistent signals; retain host judgment, do not reroll unchanged inputs. |
| `STALE_CATALOG` | CLI source readback changed; suggestion cleared. Refresh evidence before further decisions. |
| Error | No valid recommendation. Resolve the prerequisite or continue independent work. |

No result installs a skill, executes its instructions, changes providers, grants permission or overrides instruction priority. Required IDs must refer to present enabled candidates. Candidate IDs need not equal skill names; IDs must be unique even if names are duplicated.

## Offline discovery, then one bounded suggestion

```sh
node bin/jev-kit.mjs skills catalog "/absolute/path/to/skills" new-catalog.json
node bin/jev-kit.mjs skills suggest new-catalog.json "Review a patch for regressions" new-result.json
```

For catalogs larger than 19 candidates, explicitly choose a subset by ID:

```sh
node bin/jev-kit.mjs skills suggest new-catalog.json "Review a patch" new-result.json --ids s_EXAMPLE1,s_EXAMPLE2
```

Use the real IDs from your catalog; examples above are placeholders. There is no silent top-N filter. Selecting a subset narrows coverage and cannot establish the globally best skill.

Discovery reads only direct `DIRECTORY/*/SKILL.md` files: no whole-home scan, plugin-cache recursion or network call. It allows up to 256 directory entries and 128 KiB per skill, parses YAML frontmatter, keeps complete name/description and full-file hashes, and rejects invalid/oversized descriptions instead of clipping. Bodies are not exported or sent to Jev. Symlink/junction skill entries are excluded. `disable-model-invocation: true` is treated as unavailable for automatic suggestion.

Filesystem presence is not client enablement: clients may have disabled plugins or different scopes. The host must confirm candidates; the offline catalog does not read private client settings or claim to mirror every client's active registry. Use registry-supplied candidates through MCP when appropriate. Catalogs contain local paths; keep them private. CLI rechecks full skill hashes/metadata before inference and again before returning a suggestion. Hashes are read-time evidence, not filesystem locks.

Only goal, enabled skill names/descriptions and judgment questions go to TypeSafe. No full conversations, skill bodies, local source paths or user API keys are included in that payload. Common-secret pattern rejection is best effort; redact confidential descriptions yourself. Receipts under kit storage retain inputs, request, raw answers and final result. They can contain confidential task descriptions and should not be published.

## Reproducible evaluation

```sh
# Offline lexical baseline only; does not simulate Jev success
npm run eval:skills -- --output new-offline-report.json
# Up to eight distinct synthetic requests using your own configured key
npm run eval:skills -- --output new-live-report.json --live
```

The live suite stops on a transport/validation error, retains the partial report, never overwrites output and never loops to improve a score. The SDK may retry temporary HTTP responses within its deadline, as documented for the other tools. Labels stay outside model requests. A review/abstention is counted separately from correct no-match.

See [the first measured run](evaluations/skill-routing-20260922.md). It compares with a weak lexical baseline, not with Codex. It does not prove reduced host tokens, faster coding, broader skill coverage or lower total cost. Large catalogs, adversarial descriptions and multi-skill dependency planning remain follow-up evaluation work.

## Design references

Inspired by [skill-router](https://github.com/lomeshdutta/skill-router)'s task-oriented selection and the [official TypeSafe skill suggestion cookbook](https://docs.typesafe.ai/cookbooks/skill_suggestion). Implemented independently for explicit cross-client candidates. Unlike a Claude session hook, this tool is invoked by the host when needed; it does not force interception of existing conversations. Upgrading files does not prove an existing task has refreshed its tool registry.
