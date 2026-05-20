import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const KEYS = [
  'MCP_VOICENOTES_EDIT_PAT',
  'MCP_VOICENOTES_EDIT_BASE_URL',
  'MCP_VOICENOTES_EDIT_ACCESS_LEVEL',
  'MCP_VOICENOTES_EDIT_AUDIT_LOG',
  'MCP_VOICENOTES_EDIT_AUDIT_LOG_PATH',
  'MCP_VOICENOTES_EDIT_AUDIT_LOG_MAX_BYTES',
  'MCP_VOICENOTES_EDIT_AUDIT_LOG_KEEP'
] as const

const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k]
  // Re-seed the PAT so module evaluation succeeds; individual tests can override.
  process.env.MCP_VOICENOTES_EDIT_PAT = 'test|placeholder'
  for (const k of KEYS) if (k !== 'MCP_VOICENOTES_EDIT_PAT') delete process.env[k]
  vi.resetModules()
})

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('VOICENOTES_PAT', () => {
  it('reads the PAT from env', async () => {
    process.env.MCP_VOICENOTES_EDIT_PAT = '1|abc'
    const { VOICENOTES_PAT } = await import('./config.js')
    expect(VOICENOTES_PAT).toBe('1|abc')
  })

  it('throws when MCP_VOICENOTES_EDIT_PAT is unset', async () => {
    delete process.env.MCP_VOICENOTES_EDIT_PAT
    await expect(import('./config.js')).rejects.toThrow(/MCP_VOICENOTES_EDIT_PAT is required/)
  })

  it('throws when MCP_VOICENOTES_EDIT_PAT is blank', async () => {
    process.env.MCP_VOICENOTES_EDIT_PAT = '   '
    await expect(import('./config.js')).rejects.toThrow(/MCP_VOICENOTES_EDIT_PAT is required/)
  })

  it('trims whitespace around the PAT value', async () => {
    process.env.MCP_VOICENOTES_EDIT_PAT = '  1|abc  '
    const { VOICENOTES_PAT } = await import('./config.js')
    expect(VOICENOTES_PAT).toBe('1|abc')
  })
})

describe('VOICENOTES_BASE_URL', () => {
  it('defaults to https://api.voicenotes.com', async () => {
    const { VOICENOTES_BASE_URL } = await import('./config.js')
    expect(VOICENOTES_BASE_URL).toBe('https://api.voicenotes.com')
  })

  it('respects the env override', async () => {
    process.env.MCP_VOICENOTES_EDIT_BASE_URL = 'https://example.test'
    const { VOICENOTES_BASE_URL } = await import('./config.js')
    expect(VOICENOTES_BASE_URL).toBe('https://example.test')
  })

  it('strips trailing slashes', async () => {
    process.env.MCP_VOICENOTES_EDIT_BASE_URL = 'https://example.test///'
    const { VOICENOTES_BASE_URL } = await import('./config.js')
    expect(VOICENOTES_BASE_URL).toBe('https://example.test')
  })
})

describe('ACCESS_LEVEL', () => {
  it('defaults to write when unset', async () => {
    const { ACCESS_LEVEL } = await import('./config.js')
    expect(ACCESS_LEVEL).toBe('write')
  })

  it('defaults to write when blank', async () => {
    process.env.MCP_VOICENOTES_EDIT_ACCESS_LEVEL = '  '
    const { ACCESS_LEVEL } = await import('./config.js')
    expect(ACCESS_LEVEL).toBe('write')
  })

  it.each(['read', 'write', 'destructive'] as const)('accepts %s', async (level) => {
    process.env.MCP_VOICENOTES_EDIT_ACCESS_LEVEL = level
    const { ACCESS_LEVEL } = await import('./config.js')
    expect(ACCESS_LEVEL).toBe(level)
  })

  it('throws on an unknown value', async () => {
    process.env.MCP_VOICENOTES_EDIT_ACCESS_LEVEL = 'admin'
    await expect(import('./config.js')).rejects.toThrow(/Invalid MCP_VOICENOTES_EDIT_ACCESS_LEVEL="admin"/)
  })
})

describe('AUDIT_LOG_MODE', () => {
  it('defaults to writes', async () => {
    const { AUDIT_LOG_MODE } = await import('./config.js')
    expect(AUDIT_LOG_MODE).toBe('writes')
  })

  it('defaults to writes when blank', async () => {
    process.env.MCP_VOICENOTES_EDIT_AUDIT_LOG = '  '
    const { AUDIT_LOG_MODE } = await import('./config.js')
    expect(AUDIT_LOG_MODE).toBe('writes')
  })

  it.each(['off', 'writes', 'all'] as const)('accepts %s', async (mode) => {
    process.env.MCP_VOICENOTES_EDIT_AUDIT_LOG = mode
    const { AUDIT_LOG_MODE } = await import('./config.js')
    expect(AUDIT_LOG_MODE).toBe(mode)
  })

  it('throws on an unknown value', async () => {
    process.env.MCP_VOICENOTES_EDIT_AUDIT_LOG = 'sometimes'
    await expect(import('./config.js')).rejects.toThrow(/Invalid MCP_VOICENOTES_EDIT_AUDIT_LOG/)
  })
})

describe('AUDIT_LOG_PATH', () => {
  it('defaults to ~/.local/state/mcp-voicenotes-edit/audit.jsonl', async () => {
    const { AUDIT_LOG_PATH } = await import('./config.js')
    expect(AUDIT_LOG_PATH).toBe(path.join(os.homedir(), '.local', 'state', 'mcp-voicenotes-edit', 'audit.jsonl'))
  })

  it('expands a bare ~ in the override', async () => {
    process.env.MCP_VOICENOTES_EDIT_AUDIT_LOG_PATH = '~'
    const { AUDIT_LOG_PATH } = await import('./config.js')
    expect(AUDIT_LOG_PATH).toBe(os.homedir())
  })

  it('expands ~/foo in the override', async () => {
    process.env.MCP_VOICENOTES_EDIT_AUDIT_LOG_PATH = '~/foo/audit.jsonl'
    const { AUDIT_LOG_PATH } = await import('./config.js')
    expect(AUDIT_LOG_PATH).toBe(path.join(os.homedir(), 'foo', 'audit.jsonl'))
  })

  it('passes absolute paths through unchanged', async () => {
    process.env.MCP_VOICENOTES_EDIT_AUDIT_LOG_PATH = '/tmp/audit.jsonl'
    const { AUDIT_LOG_PATH } = await import('./config.js')
    expect(AUDIT_LOG_PATH).toBe('/tmp/audit.jsonl')
  })
})

describe('AUDIT_LOG_MAX_BYTES / AUDIT_LOG_KEEP', () => {
  it('use sensible defaults when unset', async () => {
    const { AUDIT_LOG_MAX_BYTES, AUDIT_LOG_KEEP } = await import('./config.js')
    expect(AUDIT_LOG_MAX_BYTES).toBe(10 * 1024 * 1024)
    expect(AUDIT_LOG_KEEP).toBe(5)
  })

  it('use defaults when blank', async () => {
    process.env.MCP_VOICENOTES_EDIT_AUDIT_LOG_MAX_BYTES = '  '
    process.env.MCP_VOICENOTES_EDIT_AUDIT_LOG_KEEP = '  '
    const { AUDIT_LOG_MAX_BYTES, AUDIT_LOG_KEEP } = await import('./config.js')
    expect(AUDIT_LOG_MAX_BYTES).toBe(10 * 1024 * 1024)
    expect(AUDIT_LOG_KEEP).toBe(5)
  })

  it('accept non-negative ints', async () => {
    process.env.MCP_VOICENOTES_EDIT_AUDIT_LOG_MAX_BYTES = '0'
    process.env.MCP_VOICENOTES_EDIT_AUDIT_LOG_KEEP = '3'
    const { AUDIT_LOG_MAX_BYTES, AUDIT_LOG_KEEP } = await import('./config.js')
    expect(AUDIT_LOG_MAX_BYTES).toBe(0)
    expect(AUDIT_LOG_KEEP).toBe(3)
  })

  it('throws on a negative value', async () => {
    process.env.MCP_VOICENOTES_EDIT_AUDIT_LOG_MAX_BYTES = '-1'
    await expect(import('./config.js')).rejects.toThrow(/MCP_VOICENOTES_EDIT_AUDIT_LOG_MAX_BYTES/)
  })

  it('throws on a non-numeric value', async () => {
    process.env.MCP_VOICENOTES_EDIT_AUDIT_LOG_KEEP = 'lots'
    await expect(import('./config.js')).rejects.toThrow(/MCP_VOICENOTES_EDIT_AUDIT_LOG_KEEP/)
  })
})
