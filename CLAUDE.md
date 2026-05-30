# CLAUDE.md

Guidance for Claude Code when working in this repo. The user-facing tool surface, install/config, and Claude Desktop setup live in [README.md](./README.md); this file covers what Claude needs that isn't in README and isn't derivable from one grep.

## Why this MCP exists alongside `mcp-voicenotes`

The upstream [voicenotes-mcp](https://github.com/samlevan/voicenotes-mcp) fork uses the **open-claw integration key** from `voicenotes.com/app?open-claw=true#settings`. That key only authenticates against `/api/integrations/open-claw/*`, which is read-only on existing recordings (`OPTIONS /recordings/{uuid}` → `Allow: GET, HEAD`). It cannot edit tags or titles.

This MCP uses the **account-scoped personal access token** (Laravel Sanctum `{id}|{secret}`) extracted from the Voicenotes web app's `Authorization` header, and hits `/api/recordings/{uuid}` (PATCH/DELETE allowed). The two MCPs are intended to run side by side: read/search via the upstream one, edits here.

## Bun vs Node

This project uses Bun (≥ 1.3) for install and dev scripts, but the compiled `dist/` runs under Node (≥ 22) — that's what Claude Desktop launches.

- `bun run test` (NOT `bun test` — the latter invokes Bun's own runner instead of vitest).
- Bun auto-loads `.env.${NODE_ENV}` from the CWD; Node needs the explicit `process.loadEnvFile()` call in [src/config.ts](./src/config.ts). The try/catch swallows the `TypeError` Bun raises (no `process.loadEnvFile`), so the same code works under both.
- `NODE_ENV` is set to `development` only by `server:mcp:dev` and `server:mcp:inspect`. Claude Desktop doesn't set it, so `.env.*` is ignored in production — `MCP_VOICENOTES_EDIT_PAT` must come from the Claude Desktop config `env` block.

Run `bun run` with no args for the full script list.

## Architecture Invariants

### Naming convention

Tool names follow `<app>_<resource>_<action>` (snake_case) with `<app>` = `voicenotes`. Singular resource for single-item ops (`note`). Current surface: `voicenotes_note_update_tags`, `voicenotes_note_update_title`.

### Access-level gate — driven by annotations, not names

[src/utils/access-level.ts](./src/utils/access-level.ts) `makeAccessGatedRegister()` decides at startup whether to register each tool, based on `config.annotations`:

- `readOnlyHint: true` → `read`
- `destructiveHint: true` → `destructive`
- explicit `readOnlyHint: false` AND `destructiveHint: false` → `write` (non-destructive mutation)
- anything else (unannotated / partially annotated) → `destructive` (fail-safe)

A tool registers when its derived level is at or below `MCP_VOICENOTES_EDIT_ACCESS_LEVEL` (default: `write` — this MCP has no read-only tools today, so `read` disables everything). New tools MUST set `annotations` explicitly using a preset from [src/utils/annotations.ts](./src/utils/annotations.ts) — do not bypass the proxy.

### Single HTTP client

All Voicenotes API calls go through [src/voicenotes-client.ts](./src/voicenotes-client.ts). New tools must reuse `patchRecording()` / `getRecording()` rather than building their own `fetch` calls — the client centralises the `Bearer` header, JSON content-type, status-code-to-`VoicenotesApiError` translation, and response unwrapping.

## Security Requirements

The security boundary is the PAT in `MCP_VOICENOTES_EDIT_PAT`. New tools and changes to existing tools MUST preserve every invariant below.

1. **The PAT never leaves the process unredacted.** Don't include it in error messages, audit-log payloads, or tool outputs. [src/utils/audit-log.ts](./src/utils/audit-log.ts) only logs the tool args (which never contain the PAT) — keep it that way.
2. **`uuid` input is regex-validated before any HTTP call.** The schema regex `/^[A-Za-z0-9]{8}$/` rejects path-segment injection. Any new identifier input that becomes a URL segment must carry the same constraint — bare `z.string().min(1)` is not acceptable.
3. **All requests go through `requestRecording()` in [src/voicenotes-client.ts](./src/voicenotes-client.ts).** `encodeURIComponent` on the uuid is belt-and-braces against future loosening of the regex; do not bypass.
4. **Destructive tools require explicit confirmation.** When `voicenotes_note_delete` lands (see [ROADMAP.md](./ROADMAP.md)), it MUST carry the `DESTRUCTIVE_ONESHOT_REMOTE` annotation, expose a `dry_run: boolean` default `true`, and only call DELETE when explicitly disabled. The `destructive` access level must be opt-in.
5. **Zod schemas are `.strict()` with bounded sizes.** Tag arrays cap at 64 entries; titles cap at 500 chars. Add bounds for every new field.
6. **Errors return via `errorResult(action, error)`, not `throw`.** The audit-log wrapper depends on the MCP `isError` envelope to log failures correctly. `errorResult` takes a short gerund action phrase (e.g. `'updating tags'`) plus the caught `error`; it formats `Error <action>: <message>` and runs the value through `errMessage()` internally — callers pass the raw `error`, not `errMessage(err)`.

## Tool registration call sites

Tools are registered in [src/tools/notes/index.ts](./src/tools/notes/index.ts). To survey the surface, `grep "registerTool" src/tools/*/index.ts`. README's [Tools](./README.md#tools) section tabulates them with purposes and I/O shapes.
