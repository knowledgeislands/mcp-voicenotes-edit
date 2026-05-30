import { describe, expect, it } from 'vitest'
import type { AccessLevel } from '../config/index.js'
import { levelFromAnnotations, makeAccessGatedRegister } from './access-level.js'
import { READ_ONLY_REMOTE, WRITE_IDEMPOTENT_REMOTE } from './annotations.js'
import type { AuditConfig } from './audit-log.js'

const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const

// Audit disabled so registration doesn't touch the filesystem.
const AUDIT_OFF: AuditConfig = { mode: 'off', path: '/dev/null', maxBytes: 0, keep: 0 }

const makeStub = () => {
  const calls: string[] = []
  const stub = { registerTool: (name: string, _config: unknown, _handler: unknown) => calls.push(name) }
  return { calls, stub }
}

const gateAt = (accessLevel: AccessLevel) => {
  const { calls, stub } = makeStub()
  const gated = makeAccessGatedRegister(stub as unknown as Parameters<typeof makeAccessGatedRegister>[0], accessLevel, AUDIT_OFF)
  gated('voicenotes_note_get', { title: 't', description: 'd', annotations: READ_ONLY_REMOTE } as never, (async () => ({ content: [] })) as never)
  gated('voicenotes_note_update_tags', { title: 't', description: 'd', annotations: WRITE_IDEMPOTENT_REMOTE } as never, (async () => ({ content: [] })) as never)
  gated('voicenotes_note_delete', { title: 't', description: 'd', annotations: DESTRUCTIVE } as never, (async () => ({ content: [] })) as never)
  return calls
}

describe('levelFromAnnotations (mcp-voicenotes-edit)', () => {
  it('maps READ_ONLY_REMOTE to read', () => {
    expect(levelFromAnnotations(READ_ONLY_REMOTE)).toBe('read')
  })

  it('maps WRITE_IDEMPOTENT_REMOTE to write', () => {
    expect(levelFromAnnotations(WRITE_IDEMPOTENT_REMOTE)).toBe('write')
  })

  it('maps destructiveHint:true to destructive', () => {
    expect(levelFromAnnotations(DESTRUCTIVE)).toBe('destructive')
  })

  it('defaults to destructive (fail-safe) for missing annotations', () => {
    expect(levelFromAnnotations(undefined)).toBe('destructive')
  })
})

describe('makeAccessGatedRegister (mcp-voicenotes-edit)', () => {
  it('registers only read-level tools at gate=read', () => {
    expect(gateAt('read')).toEqual(['voicenotes_note_get'])
  })

  it('registers read + write but not destructive at gate=write', () => {
    expect(gateAt('write')).toEqual(['voicenotes_note_get', 'voicenotes_note_update_tags'])
  })

  it('registers every level at gate=destructive', () => {
    expect(gateAt('destructive')).toEqual(['voicenotes_note_get', 'voicenotes_note_update_tags', 'voicenotes_note_delete'])
  })

  it('treats an unannotated tool as destructive (fail-safe — skipped at gate=write)', () => {
    const { calls, stub } = makeStub()
    const gated = makeAccessGatedRegister(stub as unknown as Parameters<typeof makeAccessGatedRegister>[0], 'write', AUDIT_OFF)
    gated('unannotated_tool', { title: 't', description: 'd' } as never, (async () => ({ content: [] })) as never)
    expect(calls).toEqual([])
  })
})
