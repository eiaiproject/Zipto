import { codeBlockToMarkdown } from './codeBlockToMarkdown'
import { csvToMarkdown } from './csvToMarkdown'
import { jsonToMarkdown } from './jsonToMarkdown'

export type MarkdownConversion = {
  markdown: string
  warnings: string[]
}

export function isSupportedExtension(_extension: string): boolean {
  return true // ponytail: all files supported, convert as code blocks
}

export function convertToMarkdown(
  extension: string,
  content: string,
): MarkdownConversion {
  // ponytail: all files use code blocks for consistent output
  switch (extension.toLowerCase()) {
    case 'csv':
      return csvToMarkdown(content)
    case 'json':
      return jsonToMarkdown(content)
    default:
      return { markdown: codeBlockToMarkdown(content, extension || 'text'), warnings: [] }
  }
}
