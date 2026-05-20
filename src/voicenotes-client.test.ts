import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sampleRecording = {
  data: {
    id: 'YRjeZkMc',
    title: 'Original title',
    transcript: 'hi',
    tags: [
      { id: 1, name: 'meeting', emoji: null, is_pinned: 0 },
      { id: 2, name: 'idea', emoji: null, is_pinned: 0 }
    ],
    recording_type: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-05-20T10:00:00Z',
    duration: 60000
  }
}

describe('voicenotes-client (mcp-voicenotes-edit)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.MCP_VOICENOTES_EDIT_PAT = '1209|secret'
    process.env.MCP_VOICENOTES_EDIT_BASE_URL = 'https://api.voicenotes.test'
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.MCP_VOICENOTES_EDIT_BASE_URL
  })

  it('getRecording issues GET with Bearer auth and returns the unwrapped data', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(sampleRecording), { status: 200 }))
    const { getRecording } = await import('./voicenotes-client.js')
    const result = await getRecording('YRjeZkMc')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://api.voicenotes.test/api/recordings/YRjeZkMc')
    expect(init).toMatchObject({
      method: 'GET',
      headers: { Authorization: 'Bearer 1209|secret', Accept: 'application/json', 'Content-Type': 'application/json' }
    })
    expect(init.body).toBeUndefined()
    expect(result.id).toBe('YRjeZkMc')
    expect(result.tags).toHaveLength(2)
  })

  it('patchRecording issues PATCH with the JSON body', async () => {
    const updated = { ...sampleRecording, data: { ...sampleRecording.data, tags: [{ id: 99, name: 'processed', emoji: null, is_pinned: 0 }] } }
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(updated), { status: 200 }))
    const { patchRecording } = await import('./voicenotes-client.js')
    const result = await patchRecording('YRjeZkMc', { tags: ['processed'] })
    const [, init] = fetchMock.mock.calls[0] ?? []
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ tags: ['processed'] })
    expect(result.tags[0]?.name).toBe('processed')
  })

  it('url-encodes the uuid segment', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(sampleRecording), { status: 200 }))
    const { getRecording } = await import('./voicenotes-client.js')
    // The schema upstream forbids this, but the client should still be safe if it ever leaks through.
    await getRecording('a b/c?')
    const [url] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://api.voicenotes.test/api/recordings/a%20b%2Fc%3F')
  })

  it('unwraps responses that already lack a `data` envelope', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(sampleRecording.data), { status: 200 }))
    const { getRecording } = await import('./voicenotes-client.js')
    const result = await getRecording('YRjeZkMc')
    expect(result.id).toBe('YRjeZkMc')
  })

  it('throws VoicenotesApiError with status + body on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"message":"not found"}', { status: 404 }))
    const { getRecording, VoicenotesApiError } = await import('./voicenotes-client.js')
    await expect(getRecording('aaaaaaaa')).rejects.toThrow(VoicenotesApiError)
    fetchMock.mockResolvedValueOnce(new Response('{"message":"unauthorized"}', { status: 401 }))
    const errPromise = getRecording('aaaaaaaa')
    await expect(errPromise).rejects.toMatchObject({ status: 401, body: '{"message":"unauthorized"}' })
  })

  it('truncates long error bodies in the thrown message', async () => {
    const longBody = `${'x'.repeat(600)}END`
    fetchMock.mockResolvedValueOnce(new Response(longBody, { status: 500 }))
    const { getRecording } = await import('./voicenotes-client.js')
    await expect(getRecording('aaaaaaaa')).rejects.toThrow(/HTTP 500:.*…/)
  })

  it('throws VoicenotesApiError when the body is not valid JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not json at all', { status: 200 }))
    const { getRecording } = await import('./voicenotes-client.js')
    await expect(getRecording('aaaaaaaa')).rejects.toThrow(/non-JSON body/)
  })

  it('summarizeRecording projects to id/title/tags/updated_at', async () => {
    const { summarizeRecording } = await import('./voicenotes-client.js')
    const summary = summarizeRecording(sampleRecording.data)
    expect(summary).toEqual({
      id: 'YRjeZkMc',
      title: 'Original title',
      tags: ['meeting', 'idea'],
      updated_at: '2026-05-20T10:00:00Z'
    })
  })
})
