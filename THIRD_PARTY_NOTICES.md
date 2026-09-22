# Sources and licenses

## burnigtm/jev-mcp

- Source: https://github.com/burnigtm/jev-mcp
- Pinned upstream commit: `9448f6120015f2f6c6dad7137c7f234545209918`.
- MIT; original notice preserved in `vendor/jev-mcp/LICENSE`.
- Vendored TypeScript source provides the nine judgment recipes and TypeSafe SDK adapter. Existing local changes to `policy.ts` and `tools/evaluate.ts` preserve probability-boundary correctness without relaxing thresholds. This distribution additionally checks model and request limits before inference and rejects fitted truncation in `typesafe.ts`.
- The kit uses its own MCP registration/CLI, not the upstream CLI entry.

## tonyzdev/pijev

- Source: https://github.com/tonyzdev/pijev
- Pinned upstream commit: `0b67ff916fb9c6cadd4d939b8a7a14976252efef`.
- MIT; original notice preserved in `vendor/pijev/LICENSE`.
- `discovery.ts` and `decisions.ts` are copied from the pinned source. Type-only imports refer to upstream modules; the build strips them when emitting these runtime modules. Other Pi agent runtime modules are not included or installed.
- The kit's adapter supplies complete selected source units, enforces a single bounded ranking call, preserves uncertain candidates and verifies current hashes. This is not the complete PiJev application.

## Kit integration and dependencies

The portable CLI, settings, MCP integration, evidence adapter, tests and documentation are distributed under MIT. See root LICENSE. Dependencies retain their own licenses; exact versions and integrity hashes are recorded in package-lock.json. No JevLoop, Foreman, user credentials, real project source or private receipts are distributed.

Official API reference: https://docs.typesafe.ai/api

## UI loop design references (independent implementation)

- Sac-Y/Jev-cu, MIT, revision `52d32ac24e2cea29c63d9d7c4bd6d4c401111f56`: observed desktop controls, host execution, local policy and independent outcome checks.
- wy-coliney/jev-browser-use, MIT, revision `f14b60e0ae1ee90cd73eb6650e30a666a84c021a`: existing CUA connection, named browser actions, history and handoffs.
- browser-use/jev-ultrafast, MIT, revision `1231850a0bf1a0c0341fe408ef1668dbbfdfac46`: indexed action space, one request per decision, separate text generation and action execution.

Their implementations, media and benchmark claims are not bundled or represented as this kit's results. See `docs/integration-map.md` for adopted mechanisms and unsupported parts.

## Skill routing design references

- https://github.com/lomeshdutta/skill-router at `4c538d8be575d5dee09a220c3304bd311ed97903` (MIT, Lomesh Dutta): reviewed for goal-based skill discovery and explicit no-match behavior. Its Python implementation, prompts, Claude hooks and built-in skill roster are not copied or bundled. Our cross-client candidate router/catalog are independently written; this is not an upstream port or endorsement.
- https://docs.typesafe.ai/cookbooks/skill_suggestion : reviewed for candidate relevance checking and progressive disclosure. Published cookbook accuracy results do not describe this kit. Our bounded single-request implementation differs from its large-roster two-stage workflow.
