import type { ConversionReport, ConversionResult, UnsafePathResult } from '../types/conversion'

export function createConversionReportMarkdown(report: ConversionReport): string {
  const failedFiles = report.results.filter((result) => result.status === 'failed')
  const skippedFiles = report.results.filter((result) => result.status === 'skipped')
  const status = report.cancelled ? 'Cancelled' : report.completed ? 'Completed' : 'Failed'

  return `# Conversion Report

Source ZIP: ${report.sourceZipName}
Converted at: ${report.convertedAt}

## Summary

- Status: ${status}
- Total files: ${report.totalFiles}
- Processed files: ${report.processedFiles}
- Converted: ${report.convertedFiles}
- Skipped: ${report.skippedFiles}
- Failed: ${report.failedFiles}

## Failed Files

${formatResults(failedFiles)}

## Skipped Files

${formatResults(skippedFiles)}

## Unsafe Paths

${formatUnsafePaths(report.unsafePaths)}

## Notes

- All files were processed locally in the browser.
${formatWarnings(report.warnings)}
`
}

export function createReport(params: {
  sourceZipName: string
  convertedAt: string
  completed: boolean
  cancelled: boolean
  totalFiles: number
  processedFiles: number
  convertedFiles: number
  skippedFiles: number
  failedFiles: number
  results: ConversionResult[]
  warnings: string[]
  unsafePaths: UnsafePathResult[]
}): ConversionReport {
  return params
}

export function formatConversionTimestamp(date = new Date()): string {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function formatResults(results: ConversionResult[]): string {
  if (results.length === 0) {
    return 'None.'
  }

  return results
    .map((result) => {
      return `- \`${escapeBackticks(result.sourcePath)}\`
  - Reason: ${result.reason ?? 'Unknown'}`
    })
    .join('\n')
}

function formatUnsafePaths(paths: UnsafePathResult[]): string {
  if (paths.length === 0) {
    return 'None.'
  }

  return paths
    .map((path) => {
      return `- \`${escapeBackticks(path.path)}\`
  - Action: ${path.action}
  - Reason: ${path.reason}`
    })
    .join('\n')
}

function formatWarnings(warnings: string[]): string {
  if (warnings.length === 0) {
    return ''
  }

  return warnings.map((warning) => `- ${warning}`).join('\n')
}

function escapeBackticks(value: string): string {
  return value.replace(/`/g, '\\`')
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}
