/**
 * Extract a JSON object or array from surrounding text using bracket matching.
 * Respects string boundaries so brackets inside strings are ignored.
 */
export function extractJsonBlock(text: string): string | null {
  return extractJsonBlocks(text)[0] ?? null
}

export function extractJsonBlocks(text: string): string[] {
  const candidates = [
    ...extractBracketPairs(text, '{', '}'),
    ...extractBracketPairs(text, '[', ']'),
  ]

  return candidates
    .sort((a, b) => a.start - b.start)
    .map((candidate) => candidate.value)
}

function extractBracketPairs(
  text: string,
  open: string,
  close: string,
): Array<{ start: number; value: string }> {
  const results: Array<{ start: number; value: string }> = []

  for (let startIdx = text.indexOf(open); startIdx !== -1; startIdx = text.indexOf(open, startIdx + 1)) {
    let depth = 0
    let inDouble = false
    let inSingle = false
    let escaped = false

    for (let i = startIdx; i < text.length; i++) {
      const char = text[i]

      if (inDouble || inSingle) {
        if (escaped) {
          escaped = false
          continue
        }

        if (char === '\\') {
          escaped = true
          continue
        }

        if (inDouble && char === '"') {
          inDouble = false
        } else if (inSingle && char === "'") {
          inSingle = false
        }
        continue
      }

      if (char === '"') {
        inDouble = true
        continue
      }

      if (char === "'") {
        inSingle = true
        continue
      }

      if (char === open) {
        depth++
      } else if (char === close) {
        depth--
        if (depth === 0) {
          results.push({ start: startIdx, value: text.substring(startIdx, i + 1) })
          break
        }
      }
    }
  }

  return results
}

/**
 * Last-resort regex extraction of key-value pairs from broken JSON.
 * Returns a flat object — nested structures may be lost.
 */
export function regexExtractKeyValues(text: string): Record<string, unknown> | null {
  const result: Record<string, unknown> = {}
  const propertyRegex =
    /"([^"]+)"\s*:\s*(?:"((?:[^"\\]|\\.)*)"|(\[[^\]]*\])|(\{[^}]*\})|([^,}\]\n]+))/g
  let match

  while ((match = propertyRegex.exec(text)) !== null) {
    const [, key, stringValue, arrayValue, objectValue, otherValue] = match

    if (stringValue !== undefined) {
      result[key] = stringValue
    } else if (arrayValue) {
      try {
        result[key] = JSON.parse(arrayValue)
      } catch {
        result[key] = []
      }
    } else if (objectValue) {
      try {
        result[key] = JSON.parse(objectValue)
      } catch {
        result[key] = {}
      }
    } else if (otherValue) {
      const trimmed = otherValue.trim()
      if (trimmed === 'null') result[key] = null
      else if (trimmed === 'true') result[key] = true
      else if (trimmed === 'false') result[key] = false
      else if (trimmed !== '' && !isNaN(Number(trimmed)))
        result[key] = Number(trimmed)
      else result[key] = trimmed
    }
  }

  return Object.keys(result).length > 0 ? result : null
}
