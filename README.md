# mcp-voicenotes-edit

Local stdio MCP server that **edits** Voicenotes recordings (tags, title) from Claude.

## Why a second Voicenotes MCP?

The upstream [voicenotes-mcp](https://github.com/samlevan/voicenotes-mcp) fork uses the **open-claw integration key** (the 64-hex-char string from `voicenotes.com/app?open-claw=true#settings`). That key authenticates against `/api/integrations/open-claw/*` only, and that subset is **read-only on existing recordings** — `OPTIONS /recordings/{uuid}` returns `Allow: GET, HEAD`. No PATCH, no DELETE.

This MCP uses the **account-scoped personal access token** (Laravel Sanctum format `{id}|{secret}`) — the Bearer token the Voicenotes web app itself sends. That token authenticates against `/api/recordings/*`, which exposes PATCH/DELETE on individual recordings.

Run both MCPs side by side: the upstream one for read/search, this one for edits.

## Tools

### `voicenotes_note_update_tags(uuid, tags)`

Replace the tag list on a recording.

- `uuid` (string, 8 alphanumeric chars) — the recording id, returned as `id` by the upstream `list_notes` / `search_notes` / `get_note` tools.
- `tags` (string[]) — the complete tag list. Tags missing from the array are removed; tags that don't exist on the account yet are auto-created. Pass `[]` to clear all tags.

Returns `{ id, title, tags: [name, ...], updated_at }`.

### `voicenotes_note_update_title(uuid, title)`

Rename a recording.

- `uuid` (string, 8 alphanumeric chars)
- `title` (string, 1–500 chars) — replaces the existing title in full.

Returns the same shape as `update_tags`.

## Setup

### 1. Extract your personal access token

There's no public UI for issuing API tokens — extract the one the web app uses:

1. Open <https://voicenotes.com/app> and log in.
2. Open browser DevTools → Network tab.
3. Do something that hits the API (e.g. click a note, change a tag).
4. Find a request to `api.voicenotes.com/api/recordings/...`.
5. Copy the `Authorization` header value — it looks like `Bearer 1234567|aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789AbCdEfGh` (Laravel Sanctum format: `{id}|{secret}`). Strip the leading `Bearer` and the space; the rest is your PAT.

The PAT grants **full account access** — treat it like a password. Don't commit it.

### 2. Build

```bash
bun install
bun run build
```

### 3. Wire into Claude Desktop / Claude Code

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (or the equivalent for Claude Code):

```json
{
  "mcpServers": {
    "mcp-voicenotes-edit": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-voicenotes-edit/dist/mcp-server/index.js"
      ],
      "env": {
        "MCP_VOICENOTES_EDIT_PAT": "1234567|YOUR_TOKEN_SECRET_HERE"
      }
    }
  }
}
```

Restart Claude.

## Environment variables

| Variable                                  | Required | Default                                          | Purpose                                                                                                |
| ----------------------------------------- | -------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `MCP_VOICENOTES_EDIT_PAT`                 | yes      | —                                                | Bearer personal access token (`{id}\|{secret}`).                                                       |
| `MCP_VOICENOTES_EDIT_BASE_URL`            | no       | `https://api.voicenotes.com`                     | API base URL.                                                                                          |
| `MCP_VOICENOTES_EDIT_ACCESS_LEVEL`        | no       | `write`                                          | `read` / `write` / `destructive`. `read` disables every tool — this MCP has no read-only tools.        |
| `MCP_VOICENOTES_EDIT_AUDIT_LOG`           | no       | `writes`                                         | Audit-log scope. `off` / `writes` (record only non-read tool calls) / `all` (record every invocation). |
| `MCP_VOICENOTES_EDIT_AUDIT_LOG_PATH`      | no       | `~/.local/state/mcp-voicenotes-edit/audit.jsonl` | Path to the JSONL audit log.                                                                           |
| `MCP_VOICENOTES_EDIT_AUDIT_LOG_MAX_BYTES` | no       | `10485760` (10 MiB)                              | Size-based rotation threshold in bytes. Set to `0` to disable rotation.                                |
| `MCP_VOICENOTES_EDIT_AUDIT_LOG_KEEP`      | no       | `5`                                              | Number of rotated audit-log files to retain.                                                           |

## API surface used

| Method  | Path                     | Auth           | Purpose                                                 |
| ------- | ------------------------ | -------------- | ------------------------------------------------------- |
| `PATCH` | `/api/recordings/{uuid}` | `Bearer {pat}` | Update tags or title (any field accepted by the route). |

Probed 2026-05-20. `OPTIONS /api/recordings/{uuid}` returned `Allow: GET, HEAD, PATCH, DELETE`. The `DELETE` capability is intentionally **not** wired up here — add it if you want, but the user-facing fork prompt explicitly scoped to tag/title edits.
