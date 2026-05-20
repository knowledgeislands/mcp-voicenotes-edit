/**
 * MCP tool annotations shared across this server's tools.
 *
 * Underlying MCP hints:
 *   readOnlyHint    — tool does NOT modify state
 *   destructiveHint — tool deletes/destroys state
 *   idempotentHint  — same input → same end state
 *   openWorldHint   — interacts with services outside the local environment
 *
 * Canonical preset names match the sibling MCPs:
 *   READ_ONLY_REMOTE     — open-world read
 *   STATE_TOGGLE_REMOTE  — open-world idempotent state update (same input → same end state)
 */
export const READ_ONLY_REMOTE = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const

export const STATE_TOGGLE_REMOTE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const
