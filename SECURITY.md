# Security Policy

## Reporting a Vulnerability

If you find a security issue in `@knowledgeislands/mcp-voicenotes-edit`, **please do not file a public GitHub issue.** Instead, email the maintainer directly:

- **<kris@kris.me.uk>** — subject: `mcp-voicenotes-edit security`

Include:

- A description of the issue and the impact (e.g. "PAT leaks into stdout/audit log", "uuid input bypasses regex check", "PATCH body smuggling").
- Steps to reproduce, ideally with a minimal proof-of-concept that does not require a real Voicenotes account.
- The version of the package (`npm ls @knowledgeislands/mcp-voicenotes-edit`) and Node version.

You should expect an acknowledgement within 72 hours. We aim to triage, investigate, and ship a fix within 14 days for high-severity issues.

## Scope

`mcp-voicenotes-edit` is a stdio MCP server that holds a Voicenotes personal access token (Laravel Sanctum format `{id}|{secret}`) in the `MCP_VOICENOTES_EDIT_PAT` env var and uses it to `PATCH /api/recordings/{uuid}` on `api.voicenotes.com`. It runs locally with the privileges of the user who launched it. The security boundary is the PAT itself — anyone with the PAT has full read/write access to that Voicenotes account.

In scope:

- Any code path that could write the PAT to stdout, the MCP response, the audit log, or any other observable channel.
- Input validation in `src/tools/notes/index.ts` — particularly the `uuid` regex (`^[A-Za-z0-9]{8}$`) and the bounded `tags` / `title` schemas.
- URL construction in `src/main/voicenotes-client/index.ts` — the uuid is `encodeURIComponent`-wrapped as belt-and-braces, but a missing validation upstream that lets a non-conforming uuid reach the client is still a finding.
- Boot-time validation of `MCP_VOICENOTES_EDIT_PAT` in `loadConfig()` (`src/config/index.ts`).

Out of scope:

- Issues only reproducible against a forked or modified version.
- Vulnerabilities in the Voicenotes API itself (please report those to Voicenotes; open an issue here only if `mcp-voicenotes-edit` exposes the flaw in a way the upstream service does not).
- Issues that require local OS-level access already higher-privileged than the user running the MCP server (e.g. an attacker who can already read process env).
- Storing the PAT in a Claude Desktop config file at the user's choice — this is the documented setup pattern; harden the file ACLs locally if your threat model warrants it.

## Supported Versions

Only the latest published `0.x` release receives security fixes during the pre-1.0 window. Once `1.0` lands, the same policy as the sibling MCPs applies.

| Version | Supported          |
| ------- | ------------------ |
| 0.x     | :white_check_mark: |
