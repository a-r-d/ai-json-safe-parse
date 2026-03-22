# ai-json-safe-parse

[![npm version](https://img.shields.io/npm/v/ai-json-safe-parse.svg)](https://www.npmjs.com/package/ai-json-safe-parse)
[![license](https://img.shields.io/npm/l/ai-json-safe-parse.svg)](https://github.com/a-r-d/ai-json-safe-parse/blob/master/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/ai-json-safe-parse)](https://bundlephobia.com/package/ai-json-safe-parse)

Parse malformed JSON from AI/LLM responses. Zero dependencies. Works in Node.js and browsers.

If you've built anything with ChatGPT, Claude, Gemini, or any other LLM, you've hit this: you ask for JSON and get back something that *almost* works — wrapped in markdown code blocks, sprinkled with trailing commas, decorated with smart quotes, or buried in a paragraph of explanation. `JSON.parse` chokes and your app breaks.

`ai-json-safe-parse` handles all of it. One function call, typed generics, no dependencies.

## Install

```bash
npm install ai-json-safe-parse
```

Works with any package manager (npm, yarn, pnpm, bun) and any runtime (Node.js, browsers, Deno, Cloudflare Workers, edge functions).

## Quick Start

```ts
import { aiJsonParse } from 'ai-json-safe-parse'

// Typical LLM response with markdown code fences
const llmOutput = `Sure! Here's the JSON:

\`\`\`json
{
  "sentiment": "positive",
  "confidence": 0.95,
  "keywords": ["great", "excellent", "loved it"]
}
\`\`\`

Let me know if you need anything else!`

const result = aiJsonParse<{
  sentiment: string
  confidence: number
  keywords: string[]
}>(llmOutput)

if (result.success) {
  console.log(result.data.sentiment) // "positive"
  console.log(result.data.confidence) // 0.95
}
```

## API

The library exports three functions. Pick the one that fits your error-handling style.

### `aiJsonParse<T>(text, options?)` — Result object

Returns a discriminated union: `{ success: true, data: T }` or `{ success: false, error: string }`. Never throws.

```ts
import { aiJsonParse } from 'ai-json-safe-parse'

const result = aiJsonParse<{ name: string }>(llmOutput)

if (result.success) {
  console.log(result.data.name)
} else {
  console.error(result.error)
}
```

### `aiJsonSafeParse<T>(text, options?)` — Nullable

Returns the parsed value or `null`. The simplest option when you just need the data.

```ts
import { aiJsonSafeParse } from 'ai-json-safe-parse'

const data = aiJsonSafeParse<{ name: string }>(llmOutput)
if (data) {
  console.log(data.name)
}
```

You can also pass a fallback value — if parsing fails, you get the fallback instead of `null`:

```ts
const data = aiJsonSafeParse(llmOutput, { name: 'unknown' })
// data is always { name: string }, never null
```

### `aiJsonStrictParse<T>(text, options?)` — Throws on failure

Returns the parsed value or throws an `Error`. Use this when a parse failure should be exceptional.

```ts
import { aiJsonStrictParse } from 'ai-json-safe-parse'

const data = aiJsonStrictParse<{ name: string }>(llmOutput)
console.log(data.name)
```

## What It Fixes

The parser applies recovery strategies in order, from safest to most aggressive:

| Strategy | Mode | What it handles |
|---|---|---|
| Direct `JSON.parse` | both | Already-valid JSON |
| Markdown extraction | both | `` ```json ... ``` `` and `` ``` ... ``` `` code blocks |
| Unicode normalization | both | Smart quotes `\u201C\u201D\u2018\u2019`, em/en dashes `\u2014\u2013`, non-breaking spaces, ellipsis `\u2026` |
| Bracket matching | both | JSON embedded in prose: *"Here is the result: `{...}` hope that helps!"* |
| Comment removal | aggressive | `// line comments` and `/* block comments */` (preserves URLs) |
| Trailing comma removal | aggressive | `{"a": 1,}` and `[1, 2,]` |
| Single quote replacement | aggressive | `{'name': 'Alice'}` |
| Unquoted key fix | aggressive | `{name: "Alice"}` |
| Regex key-value extraction | aggressive | Severely broken JSON (last resort) |

### Real-world examples this handles

```ts
// Markdown code blocks
aiJsonParse('```json\n{"key": "value"}\n```')

// JSON buried in a paragraph
aiJsonParse('The analysis shows {"score": 95, "grade": "A"} for this input.')

// Trailing commas (extremely common from LLMs)
aiJsonParse('{"items": ["a", "b", "c",],}')

// JavaScript-style objects with comments
aiJsonParse(`{
  name: "Alice",       // the user
  age: 30,             // in years
  active: true,
}`)

// Smart quotes from copy-paste or GPT
aiJsonParse('{\u201Cname\u201D: \u201CAlice\u201D}')

// Em dashes in content
aiJsonParse('{"range": "10\u201420"}')  // → {"range": "10-20"}
```

## Options

```ts
interface ParseOptions {
  /**
   * How aggressively to attempt repairs on malformed JSON.
   * Default: 'aggressive'
   */
  mode?: 'safe' | 'aggressive'
}
```

**`safe`** — Tries direct parse, markdown extraction, unicode normalization, and bracket matching only. Use this when data integrity is more important than recovery rate. Won't modify the JSON structure.

**`aggressive`** (default) — Additionally fixes syntax issues and falls back to regex extraction. Higher recovery rate, but may misinterpret severely malformed input.

```ts
// Only use safe recovery strategies
const result = aiJsonParse(text, { mode: 'safe' })

// Use all strategies (default)
const result = aiJsonParse(text, { mode: 'aggressive' })
```

## TypeScript

Full generic type support. All exports are fully typed.

```ts
import { aiJsonParse, aiJsonSafeParse, aiJsonStrictParse } from 'ai-json-safe-parse'
import type { ParseResult, ParseSuccess, ParseFailure, ParseOptions } from 'ai-json-safe-parse'

interface MyResponse {
  summary: string
  score: number
  tags: string[]
}

// All three functions accept a generic type parameter
const result = aiJsonParse<MyResponse>(text)       // ParseResult<MyResponse>
const data = aiJsonSafeParse<MyResponse>(text)     // MyResponse | null
const strict = aiJsonStrictParse<MyResponse>(text) // MyResponse (throws on failure)
```

## Bundle Size

Zero dependencies. Tree-shakeable ESM. The entire library is ~5KB unminified (~2KB gzipped).

Both ESM (`import`) and CommonJS (`require`) are supported via the `exports` field in `package.json`.

## Background

This library was extracted from the production codebase at [LeadTruffle](https://leadtruffle.com), where we use it to parse thousands of AI-generated JSON responses daily across our lead qualification, SMS automation, and voice AI pipelines. We run it in AWS Lambda (Node.js), Cloudflare Workers, and in-browser — so it had to be lightweight, dependency-free, and universal from day one.

After copy-pasting variations of this code across multiple services, it made sense to clean it up and share it. Thank you to LeadTruffle for supporting the open-source release.

## Testing

The test suite covers valid JSON, markdown extraction, unicode edge cases, bracket matching, all aggressive-mode fixes, safe mode, real-world LLM outputs, and error cases.

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run lint
```

Tests use [Vitest](https://vitest.dev/). To run them locally:

```bash
git clone https://github.com/a-r-d/ai-json-safe-parse.git
cd ai-json-safe-parse
npm install
npm test
```

## Contributing

Contributions are welcome! If you've hit an LLM output format that this library doesn't handle, please open an issue with the raw text — that's the most helpful thing you can provide.

To contribute code:

1. Fork the repo and create a branch
2. Add a failing test for the case you're fixing
3. Implement the fix
4. Run `npm test` to make sure everything passes
5. Run `npm run lint` to check types
6. Open a PR

Please keep PRs focused — one fix or feature per PR.

## Author

**Aaron Decker** — [ard.ninja](https://ard.ninja) / [@a-r-d](https://github.com/a-r-d)

CTO at [LeadTruffle](https://leadtruffle.com), a speed-to-lead platform for home service businesses. I've been a software engineer for 15+ years. After writing the same JSON-from-LLM parsing code across too many services, I decided to open source it. If you're building AI-powered products and burning time on malformed JSON, I hope this saves you some headaches.

## License

[MIT](LICENSE)
