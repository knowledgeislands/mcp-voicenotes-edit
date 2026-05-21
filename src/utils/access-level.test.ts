import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { READ_ONLY_REMOTE, WRITE_IDEMPOTENT_REMOTE } from './annotations.js'

const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const

describe('levelFromAnnotations / makeAccessGatedRegister (mcp-voicenotes-edit)', () => {
  beforeEach(() => {
    process.env.MCP_VOICENOTES_EDIT_PAT = 'test|placeholder'
    delete process.env.MCP_VOICENOTES_EDIT_ACCESS_LEVEL
    vi.resetModules()
  })

  afterEach(() => {
    delete process.env.MCP_VOICENOTES_EDIT_ACCESS_LEVEL
  })

  it('maps READ_ONLY_REMOTE to read', async () => {
    const { levelFromAnnotations } = await import('./access-level.js')
    expect(levelFromAnnotations(READ_ONLY_REMOTE)).toBe('read')
  })

  it('maps WRITE_IDEMPOTENT_REMOTE to write', async () => {
    const { levelFromAnnotations } = await import('./access-level.js')
    expect(levelFromAnnotations(WRITE_IDEMPOTENT_REMOTE)).toBe('write')
  })

  it('maps destructiveHint:true to destructive', async () => {
    const { levelFromAnnotations } = await import('./access-level.js')
    expect(levelFromAnnotations(DESTRUCTIVE)).toBe('destructive')
  })

  it('defaults to destructive (fail-safe) for missing annotations', async () => {
    const { levelFromAnnotations } = await import('./access-level.js')
    expect(levelFromAnnotations(undefined)).toBe('destructive')
  })

  it('rejects unknown MCP_VOICENOTES_EDIT_ACCESS_LEVEL at config load', async () => {
    process.env.MCP_VOICENOTES_EDIT_ACCESS_LEVEL = 'admin'
    await expect(import('../config.js')).rejects.toThrow(/Invalid MCP_VOICENOTES_EDIT_ACCESS_LEVEL="admin"/)
  })

  const makeStub = () => {
    const calls: string[] = []
    const stub = { registerTool: (name: string, _config: unknown, _handler: unknown) => calls.push(name) }
    return { calls, stub }
  }

  it('registers read + write but not destructive under default (gate=write)', async () => {
    const { makeAccessGatedRegister } = await import('./access-level.js')
    const { calls, stub } = makeStub()
    const gated = makeAccessGatedRegister(stub as unknown as Parameters<typeof makeAccessGatedRegister>[0])
    gated('voicenotes_note_get', { title: 't', description: 'd', annotations: READ_ONLY_REMOTE } as never, (async () => ({ content: [] })) as never)
    gated('voicenotes_note_update_tags', { title: 't', description: 'd', annotations: WRITE_IDEMPOTENT_REMOTE } as never, (async () => ({ content: [] })) as never)
    gated('voicenotes_note_delete', { title: 't', description: 'd', annotations: DESTRUCTIVE } as never, (async () => ({ content: [] })) as never)
    expect(calls).toEqual(['voicenotes_note_get', 'voicenotes_note_update_tags'])
  })

  it('registers only read-level tools when gate=read', async () => {
    process.env.MCP_VOICENOTES_EDIT_ACCESS_LEVEL = 'read'
    const { makeAccessGatedRegister } = await import('./access-level.js')
    const { calls, stub } = makeStub()
    const gated = makeAccessGatedRegister(stub as unknown as Parameters<typeof makeAccessGatedRegister>[0])
    gated('voicenotes_note_get', { title: 't', description: 'd', annotations: READ_ONLY_REMOTE } as never, (async () => ({ content: [] })) as never)
    gated('voicenotes_note_update_tags', { title: 't', description: 'd', annotations: WRITE_IDEMPOTENT_REMOTE } as never, (async () => ({ content: [] })) as never)
    expect(calls).toEqual(['voicenotes_note_get'])
  })

  it('registers every level when gate=destructive', async () => {
    process.env.MCP_VOICENOTES_EDIT_ACCESS_LEVEL = 'destructive'
    const { makeAccessGatedRegister } = await import('./access-level.js')
    const { calls, stub } = makeStub()
    const gated = makeAccessGatedRegister(stub as unknown as Parameters<typeof makeAccessGatedRegister>[0])
    gated('voicenotes_note_get', { title: 't', description: 'd', annotations: READ_ONLY_REMOTE } as never, (async () => ({ content: [] })) as never)
    gated('voicenotes_note_update_tags', { title: 't', description: 'd', annotations: WRITE_IDEMPOTENT_REMOTE } as never, (async () => ({ content: [] })) as never)
    gated('voicenotes_note_delete', { title: 't', description: 'd', annotations: DESTRUCTIVE } as never, (async () => ({ content: [] })) as never)
    expect(calls).toEqual(['voicenotes_note_get', 'voicenotes_note_update_tags', 'voicenotes_note_delete'])
  })

  it('treats an unannotated tool as destructive (fail-safe — skipped under default gate=write)', async () => {
    const { makeAccessGatedRegister } = await import('./access-level.js')
    const { calls, stub } = makeStub()
    const gated = makeAccessGatedRegister(stub as unknown as Parameters<typeof makeAccessGatedRegister>[0])
    gated('unannotated_tool', { title: 't', description: 'd' } as never, (async () => ({ content: [] })) as never)
    expect(calls).toEqual([])
  })
})
