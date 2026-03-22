/**
 * Normalize unicode characters that LLMs love to insert.
 * Em dashes, smart quotes, non-breaking spaces, etc.
 */
export function normalizeUnicode(text: string): string {
  return text
    .replace(/\u2014/g, '-') // em dash → hyphen
    .replace(/\u2013/g, '-') // en dash → hyphen
    .replace(/[\u201C\u201D]/g, '"') // smart double quotes → straight
    .replace(/[\u2018\u2019]/g, "'") // smart single quotes → straight
    .replace(/\u00A0/g, ' ') // non-breaking space → space
    .replace(/\u2026/g, '...') // ellipsis character → dots
}

/**
 * Strip markdown code fences from a string.
 * Handles ```json, ```, and bare code fences.
 */
export function stripMarkdownCodeBlock(text: string): string {
  const fenced = text.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenced?.[1]) {
    return fenced[1].trim()
  }
  return text
}

/**
 * Fix common JSON syntax issues that LLMs produce.
 */
export function fixCommonJsonIssues(text: string): string {
  const withoutComments = stripJsonLikeComments(text)
  const normalizedStrings = normalizeStrings(withoutComments)
  const withoutTrailingCommas = removeTrailingCommas(normalizedStrings)
  return quoteUnquotedPropertyNames(withoutTrailingCommas)
}

function stripJsonLikeComments(text: string): string {
  let result = ''
  let inDouble = false
  let inSingle = false
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inDouble || inSingle) {
      result += char

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
      result += char
      continue
    }

    if (char === "'") {
      inSingle = true
      result += char
      continue
    }

    if (char === '/' && next === '/') {
      i += 2
      while (i < text.length && text[i] !== '\n') {
        i++
      }
      if (i < text.length) result += text[i]
      continue
    }

    if (char === '/' && next === '*') {
      i += 2
      while (i < text.length - 1) {
        if (text[i] === '*' && text[i + 1] === '/') {
          i++
          break
        }
        i++
      }
      continue
    }

    result += char
  }

  return result
}

function normalizeStrings(text: string): string {
  let result = ''

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (char === "'") {
      const converted = readSingleQuotedString(text, i)
      if (converted) {
        result += converted.value
        i = converted.end
        continue
      }
    }

    result += char
  }

  return result
}

function readSingleQuotedString(
  text: string,
  start: number,
): { value: string; end: number } | null {
  let value = ''
  let escaped = false

  for (let i = start + 1; i < text.length; i++) {
    const char = text[i]

    if (escaped) {
      if (char === 'u' && isHexSequence(text.slice(i + 1, i + 5))) {
        value += String.fromCharCode(Number.parseInt(text.slice(i + 1, i + 5), 16))
        i += 4
      } else {
        value += decodeQuotedEscape(char)
      }
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === "'") {
      return { value: JSON.stringify(value), end: i }
    }

    value += char
  }

  return null
}

function decodeQuotedEscape(char: string): string {
  switch (char) {
    case "'":
      return "'"
    case '"':
      return '"'
    case '\\':
      return '\\'
    case '/':
      return '/'
    case 'b':
      return '\b'
    case 'f':
      return '\f'
    case 'n':
      return '\n'
    case 'r':
      return '\r'
    case 't':
      return '\t'
    default:
      return char
  }
}

function isHexSequence(text: string): boolean {
  return /^[0-9a-fA-F]{4}$/.test(text)
}

function removeTrailingCommas(text: string): string {
  let result = ''
  let inDouble = false
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inDouble) {
      result += char

      if (escaped) {
        escaped = false
        continue
      }

      if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inDouble = false
      }

      continue
    }

    if (char === '"') {
      inDouble = true
      result += char
      continue
    }

    if (char === ',') {
      let j = i + 1
      while (j < text.length && /\s/.test(text[j])) j++
      if (text[j] === '}' || text[j] === ']') {
        continue
      }
    }

    result += char
  }

  return result
}

function quoteUnquotedPropertyNames(text: string): string {
  let result = ''
  let inDouble = false
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inDouble) {
      result += char

      if (escaped) {
        escaped = false
        continue
      }

      if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inDouble = false
      }

      continue
    }

    if (char === '"') {
      inDouble = true
      result += char
      continue
    }

    if (char === '{' || char === ',') {
      result += char

      let j = i + 1
      while (j < text.length && /\s/.test(text[j])) {
        result += text[j]
        j++
      }

      if (isIdentifierStart(text[j])) {
        let keyEnd = j + 1
        while (keyEnd < text.length && isIdentifierPart(text[keyEnd])) keyEnd++

        let colonIdx = keyEnd
        while (colonIdx < text.length && /\s/.test(text[colonIdx])) colonIdx++

        if (text[colonIdx] === ':') {
          result += `"${text.slice(j, keyEnd)}"`
          result += text.slice(keyEnd, colonIdx + 1)
          i = colonIdx
          continue
        }
      }

      i = j - 1
      continue
    }

    result += char
  }

  return result
}

function isIdentifierStart(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z_$]/.test(char)
}

function isIdentifierPart(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z0-9_$]/.test(char)
}
