# Contributing

Useful contributions include reproducible client compatibility fixes, source extraction regressions, clearer setup instructions and bounded evaluation fixtures. Please open an issue describing the user-visible problem before proposing a major new execution architecture.

## Local validation

Use Node.js 22+ and ripgrep. Run `npm ci --ignore-scripts`, `npm run build`, then `npm test`. Tests use isolated temporary directories, actual local CLI/MCP transports and stubbed inference; no API key or paid call is required. Never test installers against your primary client profile without reviewing the write set.

For compatibility reports include OS, Node version, client version, kit version, installation method and redacted error. Distinguish generated configuration, successful MCP handshake, model inference and end-to-end task quality. Passing the first does not prove the others.

## Change requirements

- Preserve uncertainty, counterevidence, source hashes and explicit coverage limits.
- Keep secret values and source-bearing private receipts out of commits, issues and CI logs.
- Add regression tests for behavior changes; avoid tests that merely duplicate implementation details.
- Preserve other client configuration and refuse conflicting same-name registrations.
- Include a focused explanation of what changed and the validation actually performed.
- Do not introduce unbounded retries, automatic execution or broad repository uploads.

## Upstream and attribution

This is a community integration kit. Jev inference is provided by TypeSafe; upstream judgment recipes and discovery primitives retain their original licenses and attribution in THIRD_PARTY_NOTICES.md. The kit contributes installation, client adapters, scoped evidence workflows, credential handling, bounds and integration tests. Do not describe vendored work as newly authored here. Changes to vendor modules should be minimal and documented; updating an upstream pin requires regression verification.

Security reports follow SECURITY.md. Public issues should use synthetic reproductions rather than credentials or private projects. No response-time guarantee is offered; issue and release history record actual maintenance activity.
