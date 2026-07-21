import { codeBlockToMarkdown } from './codeBlockToMarkdown'
import { csvToMarkdown } from './csvToMarkdown'
import { htmlToMarkdown } from './htmlToMarkdown'
import { jsonToMarkdown } from './jsonToMarkdown'
import { txtToMarkdown } from './txtToMarkdown'

export type MarkdownConversion = {
  markdown: string
  warnings: string[]
}

const EMPTY_RESULT: MarkdownConversion = { markdown: '', warnings: [] }

export function convertToMarkdown(
  extension: string,
  content: string,
): MarkdownConversion {
  if (!content) {
    return EMPTY_RESULT
  }

  switch (extension.toLowerCase()) {
    case 'md':
      return { markdown: content, warnings: [] }
    case 'txt':
      return { markdown: txtToMarkdown(content), warnings: [] }
    case 'html':
    case 'htm':
      return { markdown: htmlToMarkdown(content), warnings: [] }
    case 'csv':
      return csvToMarkdown(content)
    case 'json':
      return jsonToMarkdown(content)
    default:
      return {
        markdown: codeBlockToMarkdown(content, extension || 'text'),
        warnings: [],
      }
  }
}
