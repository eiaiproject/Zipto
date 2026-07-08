import { codeBlockToMarkdown } from './codeBlockToMarkdown'
import { csvToMarkdown } from './csvToMarkdown'
import { htmlToMarkdown } from './htmlToMarkdown'
import { jsonToMarkdown } from './jsonToMarkdown'
import { txtToMarkdown } from './txtToMarkdown'

export type MarkdownConversion = {
  markdown: string
  warnings: string[]
}

const supportedExtensions = new Set([
  'txt',
  'md',
  'html',
  'htm',
  'csv',
  'json',
  'xml',
  'yaml',
  'yml',
  'log',
])

export function isSupportedExtension(extension: string): boolean {
  return supportedExtensions.has(extension.toLowerCase())
}

export function convertToMarkdown(
  extension: string,
  content: string,
): MarkdownConversion {
  switch (extension.toLowerCase()) {
    case 'txt':
    case 'md':
      return { markdown: txtToMarkdown(content), warnings: [] }
    case 'html':
    case 'htm':
      return { markdown: htmlToMarkdown(content), warnings: [] }
    case 'csv':
      return csvToMarkdown(content)
    case 'json':
      return jsonToMarkdown(content)
    case 'xml':
      return { markdown: codeBlockToMarkdown(content, 'xml'), warnings: [] }
    case 'yaml':
    case 'yml':
      return { markdown: codeBlockToMarkdown(content, 'yaml'), warnings: [] }
    case 'log':
      return { markdown: codeBlockToMarkdown(content, 'log'), warnings: [] }
    default:
      return {
        markdown: '',
        warnings: [`Unsupported file type: .${extension || 'unknown'}`],
      }
  }
}
