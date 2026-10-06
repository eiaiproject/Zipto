import { codeBlockToMarkdown } from './codeBlockToMarkdown'
import { csvToMarkdown } from './csvToMarkdown'
import { jsonToMarkdown } from './jsonToMarkdown'
import { txtToMarkdown } from './txtToMarkdown'

export type MarkdownConversion = {
  markdown: string
  warnings: string[]
}

const SUPPORTED_EXTENSIONS = new Set([
  // Plain text / documentation
  'txt', 'md', 'markdown', 'mdx', 'rst', 'adoc', 'asciidoc', 'tex', 'bib', 'log',

  // Web frontend
  'html', 'htm', 'xhtml',
  'css', 'scss', 'sass', 'less', 'styl',
  'svg',

  // JavaScript ecosystem
  'js', 'jsx', 'mjs', 'cjs',
  'ts', 'tsx', 'mts', 'cts',
  'vue', 'svelte', 'astro',
  'json', 'jsonc', 'json5',

  // Data & config
  'csv', 'tsv',
  'xml', 'yaml', 'yml',
  'toml', 'ini', 'cfg', 'conf',
  'env', 'properties', 'plist',
  'sql', 'graphql', 'gql',

  // Python
  'py', 'pyw', 'pyx', 'pxd', 'pxi',

  // Ruby
  'rb', 'rbw', 'gemspec',

  // Go
  'go',

  // Rust
  'rs', 'rlib',

  // Java & JVM
  'java', 'kt', 'kts', 'groovy', 'gradle',
  'scala', 'clj', 'cljs', 'cljc', 'edn',

  // Swift
  'swift',

  // C / C++ / C#
  'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'hh', 'hxx',
  'cs', 'fs', 'fsx',

  // PHP
  'php', 'phtml', 'php3', 'php4', 'php5', 'phps',

  // Perl
  'pl', 'pm', 't',

  // Shell / scripts
  'sh', 'bash', 'zsh', 'fish', 'ksh',
  'ps1', 'psm1', 'psd1',
  'bat', 'cmd',
  'awk', 'sed',

  // Other compiled / BEAM
  'ex', 'exs', 'erl', 'hrl',
  'lua',
  'jl',
  'dart',
  'elm',
  'hs',
  'nim', 'nims',
  'zig',
  'sol',
  'r',

  // Extensionless text files (Makefile, Dockerfile, Gemfile, …)
  '',
])

export function isSupportedExtension(extension: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extension.toLowerCase())
}

export async function convertToMarkdown(
  extension: string,
  content: string,
): Promise<MarkdownConversion> {
  if (!content) {
    return { markdown: '', warnings: [] }
  }
  const ext = extension.toLowerCase()
  switch (ext) {
    case 'csv':
      return csvToMarkdown(content)
    case 'tsv':
      return csvToMarkdown(content, '\t')
    case 'json':
    case 'jsonc':
    case 'json5':
      return jsonToMarkdown(content)
    case 'html':
    case 'htm':
    case 'xhtml':
      return { markdown: codeBlockToMarkdown(content, 'html'), warnings: [] }
    case 'txt':
    case 'md':
    case 'markdown':
    case 'mdx':
    case 'rst':
      return { markdown: txtToMarkdown(content), warnings: [] }
    case 'xml':
    case 'yaml':
    case 'yml':
    case 'log':
      return { markdown: codeBlockToMarkdown(content, ext), warnings: [] }
    default:
      return { markdown: codeBlockToMarkdown(content, ext || 'text'), warnings: [] }
  }
}
