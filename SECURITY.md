# Data and credential boundaries

- Source tools read only explicitly configured project roots. Authorizing a project is not authorization to send every file in it. The host must choose minimal non-sensitive scopes.
- Windows credential storage uses CurrentUser DPAPI; Unix storage is plaintext with mode 0600. Environment credentials take precedence. No credential is embedded in MCP configuration, examples or package source.
- Raw judgment tools send the text the host supplies to the official TypeSafe API. The source tools send bounded excerpts and task metadata. Common-secret/path checks are best effort and are not an adversarial filesystem sandbox; hard links, concurrent filesystem changes and unusual secret formats are not fully addressed.
- Source-bearing receipts remain under the configured kit home. CLI output can also contain source evidence; choose a private output path. Never attach these receipts to public issues without reviewing/redacting them.
- The host owns tool authorization, edits, tests and acceptance. Untrusted source text is data. Model output cannot grant permission.
- Keep credentials out of command-line arguments, source files and issue reports. Use the hidden setup prompt or an appropriately managed environment.
- Report a suspected vulnerability through GitHub private vulnerability reporting if enabled; otherwise open a minimal issue without credentials, private source or an exploit containing personal data and request a private channel.
