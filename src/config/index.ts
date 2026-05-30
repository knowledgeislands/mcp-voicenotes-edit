/**
 * Configuration loading. `loadConfig()` reads the environment (optionally
 * hydrated from a `.env.${NODE_ENV}` file) into a plain `Config` value that is
 * passed explicitly into every main call — so the same code runs as an MCP
 * server or from a standalone script. There is NO module-level config
 * singleton: nothing here is read at import time.
 */
import * as os from 'node:os'
import * as path from 'node:path'

const expandHome = (p: string): string => (p === '~' ? os.homedir() : p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p)

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

export type AuditLogMode = 'off' | 'writes' | 'all'

export interface Config {
  /**
   * Voicenotes personal access token. Distinct from the open-claw integration
   * key — the open-claw key only authenticates against
   * /api/integrations/open-claw/* and that subset is read-only on existing
   * recordings. Tag/title editing lives on /api/recordings/{uuid} (PATCH),
   * which requires the account-scoped PAT. Never logged or returned.
   */
  voicenotesPat: string
  voicenotesBaseUrl: string
  accessLevel: AccessLevel
  auditLogMode: AuditLogMode
  auditLogPath: string
  auditLogMaxBytes: number
  auditLogKeep: number
}

const requireEnv = (env: NodeJS.ProcessEnv, name: string): string => {
  const v = env[name]
  if (v === undefined || v.trim() === '') {
    throw new Error(`${name} is required but not set. Copy your Voicenotes personal access token (the Bearer value the web app sends to /api/recordings) into this env var.`)
  }
  return v.trim()
}

const parseAccessLevel = (raw: string | undefined): AccessLevel => {
  const v = raw?.trim()
  if (v === undefined || v === '') return 'write'
  if ((ACCESS_LEVELS as readonly string[]).includes(v)) return v as AccessLevel
  throw new Error(`Invalid MCP_VOICENOTES_EDIT_ACCESS_LEVEL="${raw}". Allowed: ${ACCESS_LEVELS.join(', ')}`)
}

const parseAuditLogMode = (raw: string | undefined): AuditLogMode => {
  const v = raw?.trim().toLowerCase()
  if (v === undefined || v === '') return 'writes'
  if (v === 'off' || v === 'writes' || v === 'all') return v
  throw new Error(`Invalid MCP_VOICENOTES_EDIT_AUDIT_LOG="${raw}" — expected one of: off, writes, all.`)
}

const parseNonNegativeInt = (raw: string | undefined, fallback: number, varName: string): number => {
  if (raw === undefined || raw.trim() === '') return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid ${varName}="${raw}" — expected a non-negative integer.`)
  }
  return n
}

/**
 * Load configuration from `env` (defaults to `process.env`, after attempting to
 * hydrate it from `.env.${NODE_ENV}`). Throws if a required var is missing.
 */
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  try {
    process.loadEnvFile(`./.env.${process.env.NODE_ENV}`)
  } catch {
    // no .env present (or Bun, which auto-loads it) — that's fine
  }

  return {
    voicenotesPat: requireEnv(env, 'MCP_VOICENOTES_EDIT_PAT'),
    voicenotesBaseUrl: (env.MCP_VOICENOTES_EDIT_BASE_URL ?? 'https://api.voicenotes.com').replace(/\/+$/, ''),
    accessLevel: parseAccessLevel(env.MCP_VOICENOTES_EDIT_ACCESS_LEVEL),
    auditLogMode: parseAuditLogMode(env.MCP_VOICENOTES_EDIT_AUDIT_LOG),
    auditLogPath: path.resolve(expandHome(env.MCP_VOICENOTES_EDIT_AUDIT_LOG_PATH ?? path.join(os.homedir(), '.local', 'state', 'mcp-voicenotes-edit', 'audit.jsonl'))),
    auditLogMaxBytes: parseNonNegativeInt(env.MCP_VOICENOTES_EDIT_AUDIT_LOG_MAX_BYTES, 10 * 1024 * 1024, 'MCP_VOICENOTES_EDIT_AUDIT_LOG_MAX_BYTES'),
    auditLogKeep: parseNonNegativeInt(env.MCP_VOICENOTES_EDIT_AUDIT_LOG_KEEP, 5, 'MCP_VOICENOTES_EDIT_AUDIT_LOG_KEEP')
  }
}
