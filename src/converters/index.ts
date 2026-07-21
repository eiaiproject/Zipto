import { codeBlockToMarkdown } from './codeBlockToMarkdown'
import { csvToMarkdown } from './csvToMarkdown'
import { htmlToMarkdown } from './htmlToMarkdown'
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
  'r', 'R',

  // Extensionless text files (Makefile, Dockerfile, Gemfile, …)
  '',
])

export function isSupportedExtension(extension: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extension.toLowerCase())
}

export function convertToMarkdown(
  extension: string,
  content: string,
): MarkdownConversion {
  switch (extension.toLowerCase()) {
    case 'csv':
      return csvToMarkdown(content)
    case 'json':
      return jsonToMarkdown(content)
    case 'html':
    case 'htm':
      return { markdown: htmlToMarkdown(content), warnings: [] }
    case 'txt':
    case 'md':
    case 'markdown':
      return { markdown: txtToMarkdown(content), warnings: [] }
    case 'xml':
    case 'yaml':
    case 'yml':
    case 'log':
      return { markdown: codeBlockToMarkdown(content, extension), warnings: [] }
    default:
      return { markdown: codeBlockToMarkdown(content, extension || 'text'), warnings: [] }
  }
}
