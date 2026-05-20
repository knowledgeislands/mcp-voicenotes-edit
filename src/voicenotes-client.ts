/**
 * Minimal HTTP client for the Voicenotes account-scoped API.
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
 */
import { VOICENOTES_BASE_URL, VOICENOTES_PAT } from './config.js'

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

const headers = (): Record<string, string> => ({
  Authorization: `Bearer ${VOICENOTES_PAT}`,
  Accept: 'application/json',
  'Content-Type': 'application/json'
})

const requestRecording = async (method: 'GET' | 'PATCH', uuid: string, body?: unknown): Promise<VoicenotesRecording> => {
  const url = `${VOICENOTES_BASE_URL}/api/recordings/${encodeURIComponent(uuid)}`
  const resp = await fetch(url, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body)
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

export const getRecording = (uuid: string): Promise<VoicenotesRecording> => requestRecording('GET', uuid)

export const patchRecording = (uuid: string, patch: Record<string, unknown>): Promise<VoicenotesRecording> => requestRecording('PATCH', uuid, patch)

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
