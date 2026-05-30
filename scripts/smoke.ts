#!/usr/bin/env node
// End-to-end smoke test: boot the built server over stdio MCP, list its tools,
// and assert the surface matches what the registration tests expect. Catches
// drift between code and the *wire* contract (in-process tests cover the
// registration call pattern; this covers the actual protocol round-trip).
//
// Run via `bun run test:smoke` (builds dist/ first). Runs in CI without real
// secrets: a placeholder MCP_VOICENOTES_EDIT_PAT satisfies config validation and
// the server never makes a network call just to list its tools.

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

// Single source of truth for the tool surface — kept in sync with the
// registration in `src/tools/notes/index.ts`. If you add a tool, update both.
const EXPECTED_TOOLS = ['voicenotes_note_update_tags', 'voicenotes_note_update_title'] as const

const die = (msg: string, detail?: unknown): never => {
  console.error(`✗ smoke failed: ${msg}`)
  if (detail !== undefined) console.error(detail)
  process.exit(1)
}

const main = async (): Promise<void> => {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp-server/index.js'],
    // Raise the access level to `destructive` so the smoke test sees the full
    // surface regardless of the server default, and supply a placeholder PAT so
    // config validation passes without a real secret.
    env: {
      ...(process.env as Record<string, string>),
      MCP_VOICENOTES_EDIT_ACCESS_LEVEL: 'destructive',
      MCP_VOICENOTES_EDIT_PAT: process.env.MCP_VOICENOTES_EDIT_PAT ?? 'test|placeholder'
    }
  })
  const client = new Client({ name: 'mcp-voicenotes-edit-smoke', version: '0.0.0' }, { capabilities: {} })

  await client.connect(transport)

  try {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    const expected = [...EXPECTED_TOOLS].sort()

    // Diff with clear messages so CI logs are actionable.
    const missing = expected.filter((n) => !names.includes(n))
    const extra = names.filter((n) => !expected.includes(n as (typeof EXPECTED_TOOLS)[number]))
    if (missing.length || extra.length) {
      die('tool surface mismatch', { missing, extra, actualCount: names.length, expectedCount: expected.length })
    }

    // Sanity: every tool advertises an inputSchema object.
    const missingSchema = tools.filter((t) => !t.inputSchema || typeof t.inputSchema !== 'object').map((t) => t.name)
    if (missingSchema.length) die('tools missing inputSchema', missingSchema)

    console.error(`✓ smoke passed: ${names.length} tools listed, all schemas present`)
  } finally {
    await client.close()
  }
}

main().catch((err) => die('uncaught', err))
