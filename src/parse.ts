import type { ParseResult, ParseOptions } from './types'
import { normalizeUnicode, stripMarkdownCodeBlock, fixCommonJsonIssues } from './sanitize'
import { extractJsonBlocks, regexExtractKeyValues } from './extract'

/**
 * Parse JSON from an AI/LLM response string. Returns a result object
 * with `success: true` and `data`, or `success: false` and `error`.
 *
 * Never throws.
 *
 * @example
 * ```ts
 * const result = aiJsonParse<{ name: string }>(llmOutput)
 * if (result.success) {
 *   console.log(result.data.name)
 * }
 * ```
 */
export function aiJsonParse<T = unknown>(
  text: string,
  options?: ParseOptions,
): ParseResult<T> {
  const mode = options?.mode ?? 'aggressive'

  if (!text || typeof text !== 'string') {
    return { success: false, error: 'Input must be a non-empty string' }
  }

  // Normalize unicode oddities
  let input = normalizeUnicode(text.trim())

  // Step 1: Try direct parse
  try {
    return { success: true, data: JSON.parse(input) as T }
  } catch {
    // continue
  }

  // Step 2: Strip markdown code fences and try again
  const stripped = stripMarkdownCodeBlock(input)
  if (stripped !== input) {
    try {
      return { success: true, data: JSON.parse(stripped) as T }
    } catch {
      // continue
    }
    input = stripped
  }

  // Step 3: Extract JSON block via bracket matching
  const blocks = extractJsonBlocks(input)
  for (const block of blocks) {
    try {
      return { success: true, data: JSON.parse(block) as T }
    } catch {
      // continue — we'll try other extracted blocks below
    }
  }

  if (mode === 'safe') {
    return {
      success: false,
      error: `Failed to parse JSON (safe mode). Input starts with: ${text.substring(0, 120)}`,
    }
  }

  // Step 4 (aggressive): Fix common syntax issues
  const aggressiveTargets = [...blocks, input]
  for (const target of aggressiveTargets) {
    const fixed = fixCommonJsonIssues(target)
    try {
      return { success: true, data: JSON.parse(fixed) as T }
    } catch {
      // continue
    }

    const extracted = regexExtractKeyValues(fixed)
    if (extracted) {
      return { success: true, data: extracted as T }
    }
  }

  return {
    success: false,
    error: `Failed to parse JSON after all attempts. Input starts with: ${text.substring(0, 120)}`,
  }
}

/**
 * Parse JSON from an AI/LLM response. Returns the parsed value or `null`.
 *
 * @example
 * ```ts
 * const data = aiJsonSafeParse<{ name: string }>(llmOutput)
 * if (data) {
 *   console.log(data.name)
 * }
 * ```
 */
export function aiJsonSafeParse<T = unknown>(
  text: string,
  options?: ParseOptions,
): T | null

/**
 * Parse JSON from an AI/LLM response. Returns the parsed value or the
 * provided fallback.
 */
export function aiJsonSafeParse<T = unknown>(
  text: string,
  optionsOrFallback: T,
  options?: ParseOptions,
): T

export function aiJsonSafeParse<T = unknown>(
  text: string,
  optionsOrFallback?: ParseOptions | T,
  maybeOptions?: ParseOptions,
): T | null {
  let fallback: T | null = null
  let options: ParseOptions | undefined

  if (
    optionsOrFallback &&
    typeof optionsOrFallback === 'object' &&
    ('mode' in optionsOrFallback)
  ) {
    options = optionsOrFallback as ParseOptions
  } else if (optionsOrFallback !== undefined) {
    fallback = optionsOrFallback as T
    options = maybeOptions
  }

  const result = aiJsonParse<T>(text, options)
  return result.success ? result.data : fallback
}

/**
 * Parse JSON from an AI/LLM response. Throws on failure.
 *
 * @throws {Error} If parsing fails after all recovery attempts.
 */
export function aiJsonStrictParse<T = unknown>(
  text: string,
  options?: ParseOptions,
): T {
  const result = aiJsonParse<T>(text, options)
  if (result.success) return result.data
  throw new Error(result.error)
}
