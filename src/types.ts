/** Successful parse result */
export interface ParseSuccess<T> {
  success: true
  data: T
}

/** Failed parse result */
export interface ParseFailure {
  success: false
  error: string
}

/** Discriminated union result from parsing */
export type ParseResult<T> = ParseSuccess<T> | ParseFailure

/** Options for parsing */
export interface ParseOptions {
  /**
   * How aggressively to attempt repairs on malformed JSON.
   *
   * - `"safe"` — Tries direct parse, markdown extraction, and bracket matching.
   *   Low risk of producing incorrect data.
   *
   * - `"aggressive"` (default) — Additionally fixes trailing commas, single quotes,
   *   unquoted keys, JS comments, and as a last resort, regex key-value extraction.
   *   Higher chance of recovering data, but may misinterpret severely malformed input.
   */
  mode?: 'safe' | 'aggressive'
}
