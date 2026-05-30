import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { WRITE_IDEMPOTENT_REMOTE } from '../../utils/annotations.js'
import { errorResult, jsonResult } from '../../utils/results.js'
import { patchRecording, summarizeRecording } from '../../voicenotes-client.js'

const uuidArg = z
  .string()
  .regex(/^[A-Za-z0-9]{8}$/, 'uuid must be exactly 8 alphanumeric characters (the Voicenotes recording id)')
  .describe('The 8-character Voicenotes recording id (e.g. "YRjeZkMc"). Returned as `id` by the listing/search tools in the read-only voicenotes-mcp.')

const tagsArg = z
  .array(
    z
      .string()
      .min(1)
      .max(64)
      .regex(/^[^\n\r\t]+$/, 'tag names cannot contain newlines or tabs')
  )
  .max(64)
  .describe(
    'The complete tag list to set on the note. Replaces any existing tags — tags missing from this array are removed. New tag names are auto-created on the account. Pass [] to clear all tags.'
  )

const titleArg = z.string().min(1).max(500).describe('The new title text. Replaces the existing title in full.')

const updateTagsInput = z
  .object({
    uuid: uuidArg,
    tags: tagsArg
  })
  .strict()

const updateTitleInput = z
  .object({
    uuid: uuidArg,
    title: titleArg
  })
  .strict()

export const registerNotesTools = (server: McpServer): void => {
  server.registerTool(
    'voicenotes_note_update_tags',
    {
      title: 'Replace the tags on a Voicenotes recording',
      description: `Set the tags on a single Voicenotes recording, replacing any existing tags in full. Wraps PATCH /api/recordings/{uuid} with body \`{"tags": [...]}\`.

Args:
  - uuid (string, required): 8-char recording id, e.g. "YRjeZkMc".
  - tags (string[], required): The complete tag list. Existing tags not in this array are removed. Tag names that don't exist yet are auto-created. Pass [] to clear all tags.

Returns:
  JSON object: { id, title, tags: [name, ...], updated_at } reflecting the post-update state.

Errors:
  - "uuid must be exactly 8 alphanumeric characters" — bad uuid format.
  - "Voicenotes PATCH … HTTP 401" — MCP_VOICENOTES_EDIT_PAT is invalid or expired.
  - "Voicenotes PATCH … HTTP 404" — no recording with that uuid on this account.`,
      inputSchema: updateTagsInput,
      annotations: WRITE_IDEMPOTENT_REMOTE
    },
    async ({ uuid, tags }) => {
      try {
        const updated = await patchRecording(uuid, { tags })
        return jsonResult(summarizeRecording(updated))
      } catch (err) {
        return errorResult('updating tags', err)
      }
    }
  )

  server.registerTool(
    'voicenotes_note_update_title',
    {
      title: 'Replace the title on a Voicenotes recording',
      description: `Set the title on a single Voicenotes recording. Wraps PATCH /api/recordings/{uuid} with body \`{"title": "…"}\`.

Args:
  - uuid (string, required): 8-char recording id, e.g. "YRjeZkMc".
  - title (string, required): The new title (1–500 chars). Replaces the existing title in full.

Returns:
  JSON object: { id, title, tags: [name, ...], updated_at } reflecting the post-update state.

Errors:
  - "uuid must be exactly 8 alphanumeric characters" — bad uuid format.
  - "Voicenotes PATCH … HTTP 401" — MCP_VOICENOTES_EDIT_PAT is invalid or expired.
  - "Voicenotes PATCH … HTTP 404" — no recording with that uuid on this account.`,
      inputSchema: updateTitleInput,
      annotations: WRITE_IDEMPOTENT_REMOTE
    },
    async ({ uuid, title }) => {
      try {
        const updated = await patchRecording(uuid, { title })
        return jsonResult(summarizeRecording(updated))
      } catch (err) {
        return errorResult('updating title', err)
      }
    }
  )
}
