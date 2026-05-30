import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadConfig } from './index.js'

// loadConfig reads from the env object it's given, so tests pass explicit envs
// (no process.env mutation, no module-reset dance).
const load = (extra: Record<string, string> = {}) => loadConfig({ MCP_VOICENOTES_EDIT_PAT: 'test|placeholder', ...extra })

describe('loadConfig', () => {
  describe('voicenotesPat', () => {
    it('reads the PAT from env', () => {
      expect(load({ MCP_VOICENOTES_EDIT_PAT: '1|abc' }).voicenotesPat).toBe('1|abc')
    })

    it('throws when MCP_VOICENOTES_EDIT_PAT is unset', () => {
      expect(() => loadConfig({})).toThrow(/MCP_VOICENOTES_EDIT_PAT is required/)
    })

    it('throws when MCP_VOICENOTES_EDIT_PAT is blank', () => {
      expect(() => loadConfig({ MCP_VOICENOTES_EDIT_PAT: '   ' })).toThrow(/MCP_VOICENOTES_EDIT_PAT is required/)
    })

    it('trims whitespace around the PAT value', () => {
      expect(load({ MCP_VOICENOTES_EDIT_PAT: '  1|abc  ' }).voicenotesPat).toBe('1|abc')
    })
  })

  describe('voicenotesBaseUrl', () => {
    it('defaults to https://api.voicenotes.com', () => {
      expect(load().voicenotesBaseUrl).toBe('https://api.voicenotes.com')
    })

    it('respects the env override', () => {
      expect(load({ MCP_VOICENOTES_EDIT_BASE_URL: 'https://example.test' }).voicenotesBaseUrl).toBe('https://example.test')
    })

    it('strips trailing slashes', () => {
      expect(load({ MCP_VOICENOTES_EDIT_BASE_URL: 'https://example.test///' }).voicenotesBaseUrl).toBe('https://example.test')
    })
  })

  describe('accessLevel', () => {
    it('defaults to write when unset', () => {
      expect(load().accessLevel).toBe('write')
    })

    it('defaults to write when blank', () => {
      expect(load({ MCP_VOICENOTES_EDIT_ACCESS_LEVEL: '  ' }).accessLevel).toBe('write')
    })

    it.each(['read', 'write', 'destructive'] as const)('accepts %s', (level) => {
      expect(load({ MCP_VOICENOTES_EDIT_ACCESS_LEVEL: level }).accessLevel).toBe(level)
    })

    it('throws on an unknown value', () => {
      expect(() => load({ MCP_VOICENOTES_EDIT_ACCESS_LEVEL: 'admin' })).toThrow(/Invalid MCP_VOICENOTES_EDIT_ACCESS_LEVEL="admin"/)
    })
  })

  describe('auditLogMode', () => {
    it('defaults to writes', () => {
      expect(load().auditLogMode).toBe('writes')
    })

    it('defaults to writes when blank', () => {
      expect(load({ MCP_VOICENOTES_EDIT_AUDIT_LOG: '  ' }).auditLogMode).toBe('writes')
    })

    it.each(['off', 'writes', 'all'] as const)('accepts %s', (mode) => {
      expect(load({ MCP_VOICENOTES_EDIT_AUDIT_LOG: mode }).auditLogMode).toBe(mode)
    })

    it('throws on an unknown value', () => {
      expect(() => load({ MCP_VOICENOTES_EDIT_AUDIT_LOG: 'sometimes' })).toThrow(/Invalid MCP_VOICENOTES_EDIT_AUDIT_LOG/)
    })
  })

  describe('auditLogPath', () => {
    it('defaults to ~/.local/state/mcp-voicenotes-edit/audit.jsonl', () => {
      expect(load().auditLogPath).toBe(path.join(os.homedir(), '.local', 'state', 'mcp-voicenotes-edit', 'audit.jsonl'))
    })

    it('expands a bare ~ in the override', () => {
      expect(load({ MCP_VOICENOTES_EDIT_AUDIT_LOG_PATH: '~' }).auditLogPath).toBe(os.homedir())
    })

    it('expands ~/foo in the override', () => {
      expect(load({ MCP_VOICENOTES_EDIT_AUDIT_LOG_PATH: '~/foo/audit.jsonl' }).auditLogPath).toBe(path.join(os.homedir(), 'foo', 'audit.jsonl'))
    })

    it('passes absolute paths through unchanged', () => {
      expect(load({ MCP_VOICENOTES_EDIT_AUDIT_LOG_PATH: '/tmp/audit.jsonl' }).auditLogPath).toBe('/tmp/audit.jsonl')
    })
  })

  describe('auditLogMaxBytes / auditLogKeep', () => {
    it('use sensible defaults when unset', () => {
      const cfg = load()
      expect(cfg.auditLogMaxBytes).toBe(10 * 1024 * 1024)
      expect(cfg.auditLogKeep).toBe(5)
    })

    it('use defaults when blank', () => {
      const cfg = load({ MCP_VOICENOTES_EDIT_AUDIT_LOG_MAX_BYTES: '  ', MCP_VOICENOTES_EDIT_AUDIT_LOG_KEEP: '  ' })
      expect(cfg.auditLogMaxBytes).toBe(10 * 1024 * 1024)
      expect(cfg.auditLogKeep).toBe(5)
    })

    it('accept non-negative ints', () => {
      const cfg = load({ MCP_VOICENOTES_EDIT_AUDIT_LOG_MAX_BYTES: '0', MCP_VOICENOTES_EDIT_AUDIT_LOG_KEEP: '3' })
      expect(cfg.auditLogMaxBytes).toBe(0)
      expect(cfg.auditLogKeep).toBe(3)
    })

    it('throws on a negative value', () => {
      expect(() => load({ MCP_VOICENOTES_EDIT_AUDIT_LOG_MAX_BYTES: '-1' })).toThrow(/MCP_VOICENOTES_EDIT_AUDIT_LOG_MAX_BYTES/)
    })

    it('throws on a non-numeric value', () => {
      expect(() => load({ MCP_VOICENOTES_EDIT_AUDIT_LOG_KEEP: 'lots' })).toThrow(/MCP_VOICENOTES_EDIT_AUDIT_LOG_KEEP/)
    })
  })
})
