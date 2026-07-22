import { codeBlockToMarkdown } from './codeBlockToMarkdown'

export type JsonConversion = {
  markdown: string
  warnings: string[]
}

export function jsonToMarkdown(content: string): JsonConversion {
  let warning: string | undefined
  try {
    JSON.parse(content) as unknown
  } catch {
    warning = 'Invalid JSON kept as original text inside a json code block.'
  }

  return {
    markdown: codeBlockToMarkdown(content, 'json'),
    warnings: warning ? [warning] : [],
  }
}
