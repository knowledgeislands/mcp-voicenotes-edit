import * as os from 'node:os'
import * as path from 'node:path'

const expandHome = (p: string): string => {
  return p === '~' ? os.homedir() : p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p
}

try {
  process.loadEnvFile(`./.env.${process.env.NODE_ENV}`)
} catch {
  // no .env present — that's fine
}

const requireEnv = (name: string): string => {
  const v = process.env[name]
  if (v === undefined || v.trim() === '') {
    throw new Error(`${name} is required but not set. Copy your Voicenotes personal access token (the Bearer value the web app sends to /api/recordings) into this env var.`)
  }
  return v.trim()
}

/**
 * Voicenotes personal access token. Distinct from the open-claw integration key
 * — the open-claw key only authenticates against /api/integrations/open-claw/*
 * and that subset is read-only on existing recordings. Tag/title editing lives
 * on /api/recordings/{uuid} (PATCH), which requires the account-scoped PAT.
 *
 * No published UI to issue the PAT today; extract it from the
 * `Authorization: Bearer …` header on any request the Voicenotes web app makes
 * to api.voicenotes.com (browser DevTools → Network).
 */
export const VOICENOTES_PAT: string = requireEnv('MCP_VOICENOTES_EDIT_PAT')

export const VOICENOTES_BASE_URL: string = (process.env.MCP_VOICENOTES_EDIT_BASE_URL ?? 'https://api.voicenotes.com').replace(/\/+$/, '')

/**
 * Single ordinal access level — matches the sibling MCPs. Each level implies
 * all lower ones:
 *   `read`        — only readOnly tools registered.
 *   `write`       — readOnly + non-destructive mutations.
 *   `destructive` — everything, including delete / overwrite.
 *
 * Default is `write` because the whole point of this MCP is editing notes;
 * lowering to `read` registers nothing useful. Raise to `destructive` only when
 * delete-style tools land here.
 */
export type AccessLevel = 'read' | 'write' | 'destructive'
export const ACCESS_LEVELS: readonly AccessLevel[] = ['read', 'write', 'destructive'] as const
export const ACCESS_LEVEL_RANK: Record<AccessLevel, number> = { read: 1, write: 2, destructive: 3 }

const parseAccessLevel = (raw: string | undefined): AccessLevel => {
  const v = raw?.trim()
  if (v === undefined || v === '') return 'write'
  if ((ACCESS_LEVELS as readonly string[]).includes(v)) return v as AccessLevel
  throw new Error(`Invalid MCP_VOICENOTES_EDIT_ACCESS_LEVEL="${raw}". Allowed: ${ACCESS_LEVELS.join(', ')}`)
}

export const ACCESS_LEVEL: AccessLevel = parseAccessLevel(process.env.MCP_VOICENOTES_EDIT_ACCESS_LEVEL)

export const AUDIT_LOG_PATH: string = path.resolve(expandHome(process.env.MCP_VOICENOTES_EDIT_AUDIT_LOG_PATH ?? path.join(os.homedir(), '.local', 'state', 'mcp-voicenotes-edit', 'audit.jsonl')))

export type AuditLogMode = 'off' | 'writes' | 'all'

const parseAuditLogMode = (raw: string | undefined): AuditLogMode => {
  const v = raw?.trim().toLowerCase()
  if (v === undefined || v === '') return 'writes'
  if (v === 'off' || v === 'writes' || v === 'all') return v
  throw new Error(`Invalid MCP_VOICENOTES_EDIT_AUDIT_LOG="${raw}" — expected one of: off, writes, all.`)
}

export const AUDIT_LOG_MODE: AuditLogMode = parseAuditLogMode(process.env.MCP_VOICENOTES_EDIT_AUDIT_LOG)

const parseNonNegativeInt = (raw: string | undefined, fallback: number, varName: string): number => {
  if (raw === undefined || raw.trim() === '') return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid ${varName}="${raw}" — expected a non-negative integer.`)
  }
  return n
}
export const AUDIT_LOG_MAX_BYTES: number = parseNonNegativeInt(process.env.MCP_VOICENOTES_EDIT_AUDIT_LOG_MAX_BYTES, 10 * 1024 * 1024, 'MCP_VOICENOTES_EDIT_AUDIT_LOG_MAX_BYTES')
export const AUDIT_LOG_KEEP: number = parseNonNegativeInt(process.env.MCP_VOICENOTES_EDIT_AUDIT_LOG_KEEP, 5, 'MCP_VOICENOTES_EDIT_AUDIT_LOG_KEEP')
