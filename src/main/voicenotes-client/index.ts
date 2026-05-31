/**
 * Minimal HTTP client for the Voicenotes account-scoped API. Every Voicenotes
 * call in this MCP goes through here — no tool builds a raw `fetch`.
 *
 * Endpoints used here live under `/api/recordings/*` and require a Bearer
 * personal access token (Laravel Sanctum format `{id}|{secret}`). This is
 * distinct from the `/api/integrations/open-claw/*` subset used by the
 * upstream voicenotes-mcp fork — that subset can't PATCH existing recordings.
 *
 * Probed 2026-05-20: `OPTIONS /api/recordings/{uuid}` returns
 * `Allow: GET, HEAD, PATCH, DELETE`. PATCH with `{"tags": [...]}` returns 200
 * and the full updated recording. Tags missing from the array are removed;
 * tags that don't exist yet are auto-created on the account.
 *
 * Security: the PAT comes from the caller-supplied Config and is attached as
 * the Bearer header only. It is NEVER interpolated into an error message, log
 * line, or tool output — VoicenotesApiError carries the response status/body,
 * neither of which contains the secret.
 */
import type { Config } from '../../config/index.js'

/** The Voicenotes-connection slice of Config every request needs. */
export type VoicenotesConfig = Pick<Config, 'voicenotesPat' | 'voicenotesBaseUrl'>

export interface VoicenotesRecordingTag {
  id: number
  name: string
  emoji: string | null
  is_pinned: number
}

export interface VoicenotesRecording {
  id: string
  title: string | null
  transcript: string | null
  tags: VoicenotesRecordingTag[]
  recording_type: number
  created_at: string
  updated_at: string
  duration: number
}

export class VoicenotesApiError extends Error {
  status: number
  body: string
  constructor(status: number, body: string, message: string) {
    super(message)
    this.name = 'VoicenotesApiError'
    this.status = status
    this.body = body
  }
}

/** Bound every Voicenotes call so a hung backend can't wedge the stdio server. */
const REQUEST_TIMEOUT_MS = 30_000

const headers = (cfg: VoicenotesConfig): Record<string, string> => ({
  Authorization: `Bearer ${cfg.voicenotesPat}`,
  Accept: 'application/json',
  'Content-Type': 'application/json'
})

const requestRecording = async (cfg: VoicenotesConfig, method: 'GET' | 'PATCH', uuid: string, body?: unknown): Promise<VoicenotesRecording> => {
  const url = `${cfg.voicenotesBaseUrl}/api/recordings/${encodeURIComponent(uuid)}`
  const resp = await fetch(url, {
    method,
    headers: headers(cfg),
    body: body === undefined ? undefined : JSON.stringify(body),
    // A timeout abort rejects the fetch; the tool boundary maps it to errorResult.
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  const text = await resp.text()
  if (!resp.ok) {
    const snippet = text.length > 500 ? `${text.slice(0, 500)}…` : text
    throw new VoicenotesApiError(resp.status, text, `Voicenotes ${method} /api/recordings/${uuid} → HTTP ${resp.status}: ${snippet}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new VoicenotesApiError(resp.status, text, `Voicenotes ${method} /api/recordings/${uuid} returned non-JSON body (HTTP ${resp.status})`)
  }
  const data = (parsed as { data?: VoicenotesRecording }).data ?? (parsed as VoicenotesRecording)
  return data
}

export const getRecording = (cfg: VoicenotesConfig, uuid: string): Promise<VoicenotesRecording> => requestRecording(cfg, 'GET', uuid)

export const patchRecording = (cfg: VoicenotesConfig, uuid: string, patch: Record<string, unknown>): Promise<VoicenotesRecording> => requestRecording(cfg, 'PATCH', uuid, patch)

/**
 * Trim the full recording payload to the fields callers care about for an
 * update result — tag/title responses are otherwise ~25 keys of noise.
 */
export const summarizeRecording = (r: VoicenotesRecording): Record<string, unknown> => ({
  id: r.id,
  title: r.title,
  tags: r.tags.map((t) => t.name),
  updated_at: r.updated_at
})
