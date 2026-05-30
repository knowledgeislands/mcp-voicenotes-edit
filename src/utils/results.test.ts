import { describe, expect, it } from 'vitest'
import { errorResult, jsonResult } from './results.js'

describe('errorResult', () => {
  it('builds the MCP error response shape with an action-prefixed message', () => {
    expect(errorResult('updating tags', new Error('boom'))).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Error updating tags: boom' }]
    })
  })

  it('coerces non-Error throwables via errMessage', () => {
    expect(errorResult('updating title', 'nope')).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Error updating title: nope' }]
    })
  })
})

describe('jsonResult', () => {
  it('serialises a payload to pretty JSON in a text block', () => {
    const r = jsonResult({ a: 1 })
    expect(r.content[0]?.type).toBe('text')
    expect(JSON.parse(r.content[0]?.text ?? '')).toEqual({ a: 1 })
  })
})
