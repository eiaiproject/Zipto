import { codeBlockToMarkdown } from './codeBlockToMarkdown'

export type JsonConversion = {
  markdown: string
  warnings: string[]
}

export function jsonToMarkdown(content: string): JsonConversion {
  try {
    const parsed = JSON.parse(content) as unknown
    return {
      markdown: codeBlockToMarkdown(JSON.stringify(parsed, null, 2), 'json'),
      warnings: [],
    }
  } catch {
    return {
      markdown: codeBlockToMarkdown(content, 'json'),
      warnings: ['Invalid JSON kept as original text inside a json code block.'],
    }
  }
}
