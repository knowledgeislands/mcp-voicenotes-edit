#!/usr/bin/env node

/**
 * mcp-voicenotes-edit
 *
 * Local stdio MCP server for editing Voicenotes recordings (tags, title) via
 * the account-scoped web API. Distinct from the upstream voicenotes-mcp fork,
 * which uses the open-claw integration key — that integration subset is
 * read-only on existing recordings and cannot edit tags.
 *
 * Configuration (environment variables):
 *   MCP_VOICENOTES_EDIT_PAT          Required. Bearer personal access token in
 *                                    Laravel Sanctum format `{id}|{secret}`.
 *                                    Extract from the Authorization header of
 *                                    any request the Voicenotes web app sends
 *                                    to api.voicenotes.com.
 *   MCP_VOICENOTES_EDIT_BASE_URL     Optional. Defaults to
 *                                    https://api.voicenotes.com.
 *   MCP_VOICENOTES_EDIT_ACCESS_LEVEL Optional. read | write | destructive.
 *                                    Default: write. This MCP registers no
 *                                    read tools today, so `read` disables
 *                                    everything.
 *   MCP_VOICENOTES_EDIT_AUDIT_LOG    Optional. off | writes | all. Default: writes.
 *   MCP_VOICENOTES_EDIT_AUDIT_LOG_PATH
 *                                    Optional. Default
 *                                    ~/.local/state/mcp-voicenotes-edit/audit.jsonl.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadConfig } from '../config/index.js'
import { registerNotesTools } from '../tools/notes/index.js'
import { makeAccessGatedRegister } from '../utils/access-level.js'

const config = loadConfig()

console.error(`mcp-voicenotes-edit starting...`)
console.error(`  MCP_VOICENOTES_EDIT_BASE_URL=${config.voicenotesBaseUrl}`)
console.error(`  MCP_VOICENOTES_EDIT_ACCESS_LEVEL=${config.accessLevel}`)
console.error(`  MCP_VOICENOTES_EDIT_AUDIT_LOG=${config.auditLogMode}${config.auditLogMode === 'off' ? '' : ` (path: ${config.auditLogPath})`}`)

const server = new McpServer({
  name: 'mcp-voicenotes-edit',
  version: '0.1.0'
})
server.registerTool = makeAccessGatedRegister(server, config.accessLevel, {
  mode: config.auditLogMode,
  path: config.auditLogPath,
  maxBytes: config.auditLogMaxBytes,
  keep: config.auditLogKeep
})

registerNotesTools(server, config)

const main = async (): Promise<void> => {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`mcp-voicenotes-edit ready`)
}

main().catch((err) => {
  console.error('mcp-voicenotes-edit fatal:', err)
  process.exit(1)
})
