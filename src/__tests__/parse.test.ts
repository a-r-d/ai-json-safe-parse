import { describe, it, expect } from 'vitest'
import { aiJsonParse, aiJsonSafeParse, aiJsonStrictParse } from '../index'

describe('aiJsonParse', () => {
  describe('valid JSON', () => {
    it('parses a plain JSON object', () => {
      const result = aiJsonParse('{"name": "Alice", "age": 30}')
      expect(result).toEqual({ success: true, data: { name: 'Alice', age: 30 } })
    })

    it('parses a JSON array', () => {
      const result = aiJsonParse('[1, 2, 3]')
      expect(result).toEqual({ success: true, data: [1, 2, 3] })
    })

    it('parses primitives', () => {
      expect(aiJsonParse('"hello"')).toEqual({ success: true, data: 'hello' })
      expect(aiJsonParse('42')).toEqual({ success: true, data: 42 })
      expect(aiJsonParse('true')).toEqual({ success: true, data: true })
      expect(aiJsonParse('null')).toEqual({ success: true, data: null })
    })

    it('handles leading/trailing whitespace', () => {
      const result = aiJsonParse('  \n  {"key": "value"}  \n  ')
      expect(result).toEqual({ success: true, data: { key: 'value' } })
    })
  })

  describe('markdown code blocks', () => {
    it('extracts JSON from ```json blocks', () => {
      const input = '```json\n{"name": "Bob"}\n```'
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: { name: 'Bob' } })
    })

    it('extracts JSON from bare ``` blocks', () => {
      const input = '```\n{"count": 5}\n```'
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: { count: 5 } })
    })

    it('extracts JSON from ```JSON blocks', () => {
      const input = '```JSON\n{"ok": true}\n```'
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: { ok: true } })
    })

    it('handles text surrounding code blocks', () => {
      const input = 'Here is the result:\n```json\n{"answer": 42}\n```\nHope that helps!'
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: { answer: 42 } })
    })
  })

  describe('unicode normalization', () => {
    it('replaces em dashes with hyphens', () => {
      const input = '{"range": "10\u201420"}'
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: { range: '10-20' } })
    })

    it('replaces en dashes with hyphens', () => {
      const input = '{"range": "10\u201320"}'
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: { range: '10-20' } })
    })

    it('replaces smart quotes with straight quotes', () => {
      const input = '{\u201Cname\u201D: \u201CAlice\u201D}'
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: { name: 'Alice' } })
    })

    it('replaces non-breaking spaces', () => {
      const input = '{"key":\u00A0"value"}'
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: { key: 'value' } })
    })
  })

  describe('bracket extraction', () => {
    it('extracts JSON object from surrounding prose', () => {
      const input = 'The answer is {"name": "Alice", "score": 95} based on the data.'
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: { name: 'Alice', score: 95 } })
    })

    it('extracts JSON array from surrounding prose', () => {
      const input = 'Here are the results: [1, 2, 3] from the analysis.'
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: [1, 2, 3] })
    })

    it('handles nested objects', () => {
      const input = 'Result: {"user": {"name": "Bob", "address": {"city": "NYC"}}}'
      const result = aiJsonParse(input)
      expect(result).toEqual({
        success: true,
        data: { user: { name: 'Bob', address: { city: 'NYC' } } },
      })
    })

    it('ignores brackets inside strings', () => {
      const input = '{"text": "use {braces} and [brackets]", "ok": true}'
      const result = aiJsonParse(input)
      expect(result).toEqual({
        success: true,
        data: { text: 'use {braces} and [brackets]', ok: true },
      })
    })
  })

  describe('aggressive mode fixes', () => {
    it('fixes trailing commas', () => {
      const input = '{"a": 1, "b": 2,}'
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: { a: 1, b: 2 } })
    })

    it('fixes trailing commas in arrays', () => {
      const input = '[1, 2, 3,]'
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: [1, 2, 3] })
    })

    it('fixes single-quoted property names', () => {
      const input = "{'name': 'Alice'}"
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: { name: 'Alice' } })
    })

    it('fixes unquoted property names', () => {
      const input = '{name: "Alice", age: 30}'
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: { name: 'Alice', age: 30 } })
    })

    it('removes single-line JS comments', () => {
      const input = `{
        "name": "Alice", // this is the name
        "age": 30 // and the age
      }`
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: { name: 'Alice', age: 30 } })
    })

    it('removes multi-line JS comments', () => {
      const input = `{
        /* user info */
        "name": "Alice",
        "age": 30
      }`
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: { name: 'Alice', age: 30 } })
    })

    it('does not strip URLs containing //', () => {
      const input = '{"url": "https://example.com"}'
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: { url: 'https://example.com' } })
    })

    it('preserves // inside single-quoted strings', () => {
      const input = "{text: 'look // keep this', ok: true}"
      const result = aiJsonParse(input)
      expect(result).toEqual({
        success: true,
        data: { text: 'look // keep this', ok: true },
      })
    })

    it('preserves escaped apostrophes in single-quoted strings', () => {
      const input = "{'text': 'Bob\\'s car', 'ok': true}"
      const result = aiJsonParse(input)
      expect(result).toEqual({
        success: true,
        data: { text: "Bob's car", ok: true },
      })
    })

    it('handles multiple issues at once', () => {
      const input = `Here is the JSON:
\`\`\`json
{
  name: 'Alice',
  age: 30, // years old
  hobbies: ['reading', 'coding',],
}
\`\`\``
      const result = aiJsonParse(input)
      expect(result).toEqual({
        success: true,
        data: { name: 'Alice', age: 30, hobbies: ['reading', 'coding'] },
      })
    })
  })

  describe('safe mode', () => {
    it('does not fix trailing commas in safe mode', () => {
      const input = '{"a": 1, "b": 2,}'
      const result = aiJsonParse(input, { mode: 'safe' })
      expect(result.success).toBe(false)
    })

    it('still extracts from markdown in safe mode', () => {
      const input = '```json\n{"a": 1}\n```'
      const result = aiJsonParse(input, { mode: 'safe' })
      expect(result).toEqual({ success: true, data: { a: 1 } })
    })

    it('still extracts via bracket matching in safe mode', () => {
      const input = 'The result is {"ok": true} done.'
      const result = aiJsonParse(input, { mode: 'safe' })
      expect(result).toEqual({ success: true, data: { ok: true } })
    })
  })

  describe('regex fallback (aggressive)', () => {
    it('extracts key-value pairs from severely broken JSON', () => {
      const input = '{ "name": "Alice", "age": 30, "active": true, "score": null }'
      // This is actually valid, so it'll parse normally. Let's break it:
      const broken = '"name": "Alice", "age": 30, "active": true'
      const result = aiJsonParse(broken)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ name: 'Alice', age: 30, active: true })
      }
    })

    it('finds a later JSON object after earlier non-JSON braces', () => {
      const input = 'Use {braces} literally. Actual data: {"ok": true}'
      const result = aiJsonParse(input)
      expect(result).toEqual({ success: true, data: { ok: true } })
    })
  })

  describe('error cases', () => {
    it('returns failure for empty string', () => {
      const result = aiJsonParse('')
      expect(result.success).toBe(false)
    })

    it('returns failure for non-string input', () => {
      const result = aiJsonParse(null as unknown as string)
      expect(result.success).toBe(false)
    })

    it('returns failure for completely non-JSON text', () => {
      const result = aiJsonParse('Hello, how are you today?')
      expect(result.success).toBe(false)
    })
  })

  describe('real-world LLM outputs', () => {
    it('handles ChatGPT-style response with explanation', () => {
      const input = `Sure! Here's the JSON you requested:

\`\`\`json
{
  "summary": "The project is on track",
  "risk_level": "low",
  "items": [
    {"id": 1, "status": "done"},
    {"id": 2, "status": "in_progress"}
  ]
}
\`\`\`

Let me know if you need anything else!`
      const result = aiJsonParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          summary: 'The project is on track',
          risk_level: 'low',
          items: [
            { id: 1, status: 'done' },
            { id: 2, status: 'in_progress' },
          ],
        })
      }
    })

    it('handles response with just the object and some preamble', () => {
      const input = `Based on the analysis, I've determined:
{"sentiment": "positive", "confidence": 0.92, "keywords": ["great", "excellent"]}`
      const result = aiJsonParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          sentiment: 'positive',
          confidence: 0.92,
          keywords: ['great', 'excellent'],
        })
      }
    })

    it('handles newlines and irregular spacing inside JSON', () => {
      const input = `{
  "question":    "What is AI?",
  "answer":
    "Artificial Intelligence is a field of computer science."
}`
      const result = aiJsonParse(input)
      expect(result.success).toBe(true)
    })
  })
})

describe('aiJsonSafeParse', () => {
  it('returns parsed data on success', () => {
    const data = aiJsonSafeParse<{ a: number }>('{"a": 1}')
    expect(data).toEqual({ a: 1 })
  })

  it('returns null on failure', () => {
    const data = aiJsonSafeParse('not json')
    expect(data).toBeNull()
  })

  it('returns fallback on failure', () => {
    const data = aiJsonSafeParse('not json', { fallback: true })
    expect(data).toEqual({ fallback: true })
  })

  it('accepts parse options', () => {
    const data = aiJsonSafeParse('{"a": 1,}', { mode: 'safe' })
    expect(data).toBeNull()
  })

  it('accepts fallback + options', () => {
    const data = aiJsonSafeParse('{"a": 1,}', 'default', { mode: 'safe' })
    expect(data).toBe('default')
  })
})

describe('aiJsonStrictParse', () => {
  it('returns parsed data on success', () => {
    const data = aiJsonStrictParse<{ a: number }>('{"a": 1}')
    expect(data).toEqual({ a: 1 })
  })

  it('throws on failure', () => {
    expect(() => aiJsonStrictParse('not json')).toThrow()
  })
})
