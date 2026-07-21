import Papa from 'papaparse'

export type CsvConversion = {
  markdown: string
  warnings: string[]
}

export function csvToMarkdown(content: string): CsvConversion {
  const parsed = Papa.parse<string[]>(content, {
    skipEmptyLines: true,
  })
  const rows = parsed.data.filter((row) => Array.isArray(row))
  const width = Math.max(1, ...rows.map((row) => row.length))
  const firstRow = normalizeRow(rows[0] ?? [], width)
  const hasHeader = firstRow.some((cell) => cell.trim())
  const headers = hasHeader
    ? firstRow
    : Array.from({ length: width }, (_, index) => `Column ${index + 1}`)
  const bodyRows = hasHeader ? rows.slice(1) : rows
  const warnings = parsed.errors.map((error) => error.message)

  if (rows.length === 0) {
    return {
      markdown: '| Column 1 |\n|---|\n',
      warnings,
    }
  }

  const table = [
    markdownTableRow(headers),
    markdownTableRow(headers.map(() => '---')),
    ...bodyRows.map((row) => markdownTableRow(normalizeRow(row, width))),
  ]

  return {
    markdown: `${table.join('\n')}\n`,
    warnings,
  }
}

function normalizeRow(row: string[], width: number): string[] {
  return Array.from({ length: width }, (_, index) => row[index] ?? '')
}

function markdownTableRow(cells: string[]): string {
  return `| ${cells.map(escapeCell).join(' | ')} |`
}

function escapeCell(cell: string): string {
  return cell.replace(/\r?\n/g, ' ').replaceAll('|', String.raw`\|`).trim()
}
