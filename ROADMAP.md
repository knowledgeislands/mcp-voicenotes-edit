# Roadmap

Forward-looking plans only. Shipped features live in [README.md](./README.md); release history lives in [CHANGELOG.md](./CHANGELOG.md).

## Next Up

- `voicenotes_note_delete` — `DELETE /api/recordings/{uuid}` is allow-listed by the same route this MCP already uses (probed 2026-05-20). Must ship with `dry_run: boolean` default `true` and the `DESTRUCTIVE_ONESHOT_REMOTE` annotation per the security policy in [CLAUDE.md](./CLAUDE.md#security-requirements).
- `voicenotes_note_get` — convenience read over the same Bearer-PAT route so callers don't need both this MCP and the upstream open-claw one for a simple "show me the current tags before I edit" workflow.

## Future Advanced Capabilities

- Batch tag operations (`voicenotes_notes_tag_add`, `..._tag_remove`) that fan out one PATCH per uuid with concurrency limits — useful for cleanup passes across many notes.
- `voicenotes_tags_list` — enumerate the account's tag vocabulary (probably `GET /api/tags`, unverified).
- Granular `dry_run` reporting that shows the _diff_ (current tags → new tags) without applying.

## Tooling

- Vitest test coverage for `config.ts` env parsing, `voicenotes-client.ts` error translation, and `tools/notes` schema validation — current repo ships without tests.
