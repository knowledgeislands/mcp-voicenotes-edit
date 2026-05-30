import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuditConfig } from './audit-log.js'

describe('appendAuditEvent / withAuditLog (mcp-voicenotes-edit)', () => {
  const tmpDir = path.join(os.tmpdir(), 'mcp-voicenotes-edit-audit-log-tests', `run-${process.pid}-${Date.now()}`)
  const logPath = path.join(tmpDir, 'audit.jsonl')

  // The audit-log module keeps internal state (chmodEnsured, the append queue),
  // so reset modules per test for isolation. Config is passed in explicitly.
  const auditCfg = (o: Partial<AuditConfig> = {}): AuditConfig => ({ mode: 'writes', path: logPath, maxBytes: 10 * 1024 * 1024, keep: 5, ...o })

  beforeEach(async () => {
    await fs.mkdir(tmpDir, { recursive: true })
    vi.resetModules()
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  const flushAsync = () => new Promise((r) => setTimeout(r, 20))

  it('returns the handler verbatim for read-level tools in default writes mode', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const handler = vi.fn(async (_args: unknown) => ({ content: [{ type: 'text', text: 'ok' }] }))
    expect(withAuditLog(auditCfg(), 'voicenotes_note_get', 'read', handler)).toBe(handler)
    await handler({})
    await flushAsync()
    await expect(fs.access(logPath)).rejects.toThrow()
  })

  it('logs write-level tools by default (writes mode)', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog(auditCfg(), 'voicenotes_note_update_tags', 'write', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({ uuid: 'YRjeZkMc', tags: ['x'] })
    await flushAsync()
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.server).toBe('mcp-voicenotes-edit')
    expect(event.tool).toBe('voicenotes_note_update_tags')
    expect(event.level).toBe('write')
    expect(event.ok).toBe(true)
    expect(event.args).toEqual({ uuid: 'YRjeZkMc', tags: ['x'] })
  })

  it('logs read-level tools when mode=all', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog(auditCfg({ mode: 'all' }), 'voicenotes_note_get', 'read', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({ uuid: 'YRjeZkMc' })
    await flushAsync()
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.tool).toBe('voicenotes_note_get')
    expect(event.ok).toBe(true)
  })

  it('records ok:false when isError:true', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog(auditCfg(), 'voicenotes_note_update_tags', 'write', async () => ({ isError: true, content: [{ type: 'text', text: 'bad uuid' }] }))
    await wrapped({})
    await flushAsync()
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.ok).toBe(false)
    expect(event.error).toBe('bad uuid')
  })

  it('records ok:false when the handler throws', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog(auditCfg(), 'voicenotes_note_update_tags', 'write', async () => {
      throw new Error('kaboom')
    })
    await expect(wrapped({})).rejects.toThrow(/kaboom/)
    await flushAsync()
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.ok).toBe(false)
    expect(event.error).toBe('kaboom')
  })

  it('stringifies non-Error throws into the audit log', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog(auditCfg(), 'voicenotes_note_update_tags', 'write', async () => {
      throw 'string-throw'
    })
    await expect(wrapped({})).rejects.toBe('string-throw')
    await flushAsync()
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.error).toBe('string-throw')
  })

  it('skips logging entirely when mode=off', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const writeHandler = vi.fn(async (_args: unknown) => ({ content: [{ type: 'text', text: 'ok' }] }))
    expect(withAuditLog(auditCfg({ mode: 'off' }), 'voicenotes_note_update_tags', 'write', writeHandler)).toBe(writeHandler)
    await writeHandler({})
    await flushAsync()
    await expect(fs.access(logPath)).rejects.toThrow()
  })

  it('returns a non-error result envelope on success', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog(auditCfg(), 'voicenotes_note_update_tags', 'write', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    const result = (await wrapped({})) as { content: Array<{ type: string; text: string }> }
    expect(result.content[0]?.text).toBe('ok')
  })

  it('handles missing content array on isError results', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog(auditCfg(), 'voicenotes_note_update_tags', 'write', async () => ({ isError: true }) as unknown as { content: { type: string; text: string }[] })
    await wrapped({})
    await flushAsync()
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.ok).toBe(false)
    expect(event.error).toBeUndefined()
  })

  it('chmods the audit log to 0o600 on first write (even if it pre-existed at 0o644)', async () => {
    await fs.mkdir(path.dirname(logPath), { recursive: true })
    await fs.writeFile(logPath, '', { mode: 0o644 })
    expect(((await fs.stat(logPath)).mode & 0o777).toString(8)).toBe('644')

    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog(auditCfg(), 'voicenotes_note_update_tags', 'write', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({})
    await flushAsync()

    expect(((await fs.stat(logPath)).mode & 0o777).toString(8)).toBe('600')
  })

  it('truncates oversized argument payloads with a _truncated marker', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog(auditCfg(), 'voicenotes_note_update_tags', 'write', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({ blob: 'x'.repeat(8000) })
    await flushAsync()
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.args._truncated).toBe(true)
    expect(typeof event.args.preview).toBe('string')
  })

  it('rotates the audit log when it exceeds maxBytes', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog(auditCfg({ maxBytes: 64 }), 'voicenotes_note_update_tags', 'write', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    // Two writes, each event JSON exceeds 64 bytes.
    await wrapped({ uuid: 'YRjeZkMc', tags: ['a'] })
    await flushAsync()
    await wrapped({ uuid: 'YRjeZkMc', tags: ['b'] })
    await flushAsync()
    const rotated = await fs.readFile(`${logPath}.1`, 'utf-8')
    expect(rotated.length).toBeGreaterThan(0)
  })

  it('discards the live log when keep=0', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog(auditCfg({ maxBytes: 64, keep: 0 }), 'voicenotes_note_update_tags', 'write', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({ uuid: 'YRjeZkMc', tags: ['a'] })
    await flushAsync()
    await wrapped({ uuid: 'YRjeZkMc', tags: ['b'] })
    await flushAsync()
    // Rotation deleted the live log; no .1 sibling either.
    await expect(fs.access(`${logPath}.1`)).rejects.toThrow()
  })

  it('shifts existing rotation slots when rotating', async () => {
    await fs.mkdir(path.dirname(logPath), { recursive: true })
    // Seed an existing .1 slot so the rename .1 → .2 path runs.
    await fs.writeFile(`${logPath}.1`, 'prior-rotation\n', { mode: 0o600 })

    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog(auditCfg({ maxBytes: 64, keep: 3 }), 'voicenotes_note_update_tags', 'write', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({ uuid: 'YRjeZkMc', tags: ['a'] })
    await flushAsync()
    await wrapped({ uuid: 'YRjeZkMc', tags: ['b'] })
    await flushAsync()

    // After two rotations the seeded `.1` shifts to `.3` (.1→.2, then .1→.2 / .2→.3).
    const three = await fs.readFile(`${logPath}.3`, 'utf-8')
    expect(three).toBe('prior-rotation\n')
  })

  it('is a no-op when maxBytes=0 (rotation disabled)', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog(auditCfg({ maxBytes: 0 }), 'voicenotes_note_update_tags', 'write', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({ uuid: 'YRjeZkMc', tags: ['a'] })
    await flushAsync()
    await wrapped({ uuid: 'YRjeZkMc', tags: ['b'] })
    await flushAsync()
    await expect(fs.access(`${logPath}.1`)).rejects.toThrow()
  })

  it('silently absorbs write failures (writes to a non-writable parent)', async () => {
    const badPath = path.join(tmpDir, 'no-perms', 'audit.jsonl')
    await fs.mkdir(path.dirname(badPath), { recursive: true })
    await fs.chmod(path.dirname(badPath), 0o500)

    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog(auditCfg({ path: badPath }), 'voicenotes_note_update_tags', 'write', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {})
    // The tool call must still succeed even though the audit log write fails.
    const result = (await wrapped({})) as { content: Array<{ type: string; text: string }> }
    expect(result.content[0]?.text).toBe('ok')
    await flushAsync()
    consoleErr.mockRestore()

    // Restore perms so afterEach can rm the tree.
    await fs.chmod(path.dirname(badPath), 0o700)
  })
})
