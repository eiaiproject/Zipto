import TurndownService from 'turndown'
import { parseHTML } from 'linkedom'

const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
})

turndownService.remove([
  'script',
  'style',
  'noscript',
  'iframe',
  'object',
  'embed',
  'canvas',
  'meta',
  'link',
])

turndownService.addRule('markdownTable', {
  filter: 'table',
  replacement(_content, node) {
    return tableToMarkdown(node)
  },
})

export function htmlToMarkdown(content: string): string {
  const html = /<html[\s>]/i.test(content)
    ? content
    : `<!doctype html><html><body>${content}</body></html>`
  const { document } = parseHTML(html)

  document
    .querySelectorAll('script, style, noscript, iframe, object, embed, canvas, svg')
    .forEach((node) => node.remove())

  return `${turndownService.turndown(document.body).trim()}\n`
}

function tableToMarkdown(node: HTMLElement): string {
  const rows = Array.from(node.querySelectorAll('tr')).map((row) => {
    return Array.from(row.querySelectorAll('th,td')).map((cell) =>
      normalizeCell(cell.textContent ?? ''),
    )
  })
  const usableRows = rows.filter((row) => row.length > 0)

  if (usableRows.length === 0) {
    return ''
  }

  const width = Math.max(...usableRows.map((row) => row.length))
  const header = normalizeRow(usableRows[0] ?? [], width)
  const body = usableRows.slice(1).map((row) => normalizeRow(row, width))

  return `\n\n${[
    tableRow(header),
    tableRow(header.map(() => '---')),
    ...body.map(tableRow),
  ].join('\n')}\n\n`
}

function normalizeRow(row: string[], width: number): string[] {
  return Array.from({ length: width }, (_, index) => row[index] ?? '')
}

function tableRow(cells: string[]): string {
  const escaped = cells.map((cell) => cell.replaceAll('|', String.raw`\|`))
  return `| ${escaped.join(' | ')} |`
}

function normalizeCell(cell: string): string {
  return cell.replace(/\s+/g, ' ').trim()
}
