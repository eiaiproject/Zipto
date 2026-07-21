# Zipto Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incrementally improve Zipto's core conversion logic, output quality, code cleanliness, and UX.

**Architecture:** Each task touches a focused area (types, converters, worker, report, UI components). Tasks build on each other minimally — most can be done in order without blocking.

**Tech Stack:** React 19 + TypeScript + Vite, fflate, Turndown, PapaParse, linkedom, vite-plugin-pwa

## Global Constraints

- All conversion runs in a Web Worker — UI thread must never block.
- No new external dependencies. Use only packages already in `package.json`.
- Output ZIP always contains `output.md` and `conversion-report.md`.
- Folder structure is always preserved.
- All files are processed locally; no data leaves the browser.
- Remove all `// ponytail:` comments from every file.
- Use `unknown` instead of `any` where possible for type safety.

---

## File Structure

### Modified Files

| File | Change |
|------|--------|
| `src/types/conversion.ts` | Remove `ConversionOptions`, strengthen return types |
| `src/converters/index.ts` | Rewire converter routing, remove `isSupportedExtension`, remove ponytail comments |
| `src/worker/conversion.worker.ts` | Add summary header, TOC, separator; remove ponytail comments; handle options removal |
| `src/report/createConversionReport.ts` | Enhanced report formatting |
| `src/app/App.tsx` | Remove `defaultOptions`, fix output filename, simplify |
| `src/app/components/ResultPanel.tsx` | Add output preview snippet + skip-files notice |

---

### Task 1: Type Cleanup — Remove ConversionOptions

**Files:**
- Modify: `src/types/conversion.ts`

**Interfaces:**
- Consumes: (nothing — clean up existing types)
- Produces: Cleaned-up type definitions that later tasks rely on

**Changes:**

1. Remove the `ConversionOptions` type entirely.
2. Remove `options` field from `WorkerRequest.START_CONVERSION` (only `file` remains).
3. Inline `ConversionReport` creation — remove the `createReport` wrapper function, just build the object directly. (No, keep `createReport` as it's used elsewhere. Just change its params.)
4. Strengthen `ConversionResult.outputPath` from `string | undefined` to `string | undefined` (keep — it's fine).

Let me refine: `createReport` takes params as a single object. That's clean. Just remove the `options` parameter where it's used.

- [x] **Step 1: Remove `ConversionOptions` type**

```typescript
// Delete this entire block:
export type ConversionOptions = {
  preserveFolderStructure: true
  includeConversionReport: true
}
```

- [x] **Step 2: Simplify `WorkerRequest`**

```typescript
// Change from:
export type WorkerRequest =
  | {
      type: 'START_CONVERSION'
      file: File
      options: ConversionOptions
    }
  | {
      type: 'CANCEL'
    }

// To:
export type WorkerRequest =
  | {
      type: 'START_CONVERSION'
      file: File
    }
  | {
      type: 'CANCEL'
    }
```

- [x] **Step 3: Add return type to `createReport`**

The `createReport` function in `createConversionReport.ts` already returns `ConversionReport`. But let's make sure it has an explicit return type annotation.

- [x] **Step 4: Commit**

```bash
git add src/types/conversion.ts
git commit -m "refactor: remove ConversionOptions type, simplify WorkerRequest"
```

---

### Task 2: Converter Index Rewrite — Smart Extension Handling

**Files:**
- Modify: `src/converters/index.ts`
- Modify: `src/converters/txtToMarkdown.ts` (minor — ensure export is used)
- (Verify: `src/converters/htmlToMarkdown.ts`, `csvToMarkdown.ts`, `jsonToMarkdown.ts`, `codeBlockToMarkdown.ts` — no changes needed)

**Interfaces:**
- Consumes: `MarkdownConversion` type (already defined in index.ts), individual converter functions
- Produces: `convertToMarkdown(extension: string, content: string): MarkdownConversion` — correctly routes per extension

- [ ] **Step 1: Rewrite `src/converters/index.ts`**

Replace the entire file:

```typescript
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
```

- [ ] **Step 2: Run `npx tsc --noEmit` to verify types**

```bash
cd /Users/irawananggie/Documents/Zipto && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/converters/index.ts
git commit -m "feat: add smart extension handling for md, txt, html, csv, json"
```

---

### Task 3: Worker — Summary Header, TOC & Separator

**Files:**
- Modify: `src/worker/conversion.worker.ts`

**Interfaces:**
- Consumes: WorkerRequest with no `options` field (from Task 1), `convertToMarkdown` from Task 2
- Produces: WorkerResponse with properly structured output.md

**Changes:**

1. After all sections are collected, build a summary header block.
2. Generate a Table of Contents from the section headings.
3. Join everything with `\n\n---\n\n` separators.
4. Remove ponytail comments.
5. Remove references to `options.preserveFolderStructure` (always true) and `options.includeConversionReport` (always true).

- [ ] **Step 1: Add helper function for summary + TOC generation**

At the bottom of `conversion.worker.ts` (before `export {}`), add:

```typescript
function buildOutputMarkdown(
  sections: string[],
  sourceZipName: string,
  totalFiles: number,
  convertedFiles: number,
  skippedFiles: number,
  failedFiles: number,
): string {
  const timestamp = formatConversionTimestamp()
  const header = `# ZIP to Markdown Output

**Source ZIP:** \`${sourceZipName}\`
**Converted at:** ${timestamp}
**Total files:** ${totalFiles} | **Converted:** ${convertedFiles} | **Skipped:** ${skippedFiles} | **Failed:** ${failedFiles}

## Table of Contents

${generateToc(sections)}

---

`
  return header + sections.join('\n\n---\n\n') + '\n'
}

function generateToc(sections: string[]): string {
  const headingRegex = /^##\s+(.+)$/m
  return sections
    .map((section) => {
      const match = headingRegex.exec(section)
      if (!match) return null
      const title = match[1]!
      const anchor = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
      return `- [${title}](#${anchor})`
    })
    .filter((item): item is string => item !== null)
    .join('\n')
}
```

Import `formatConversionTimestamp` at the top:

```typescript
import {
  createConversionReportMarkdown,
  createReport,
  formatConversionTimestamp,
} from '../report/createConversionReport'
```

- [ ] **Step 2: Update the final output assembly in `startConversion`**

Before `outputFiles['output.md'] = markdownToBytes(sections.join('\n\n'))`, change to:

```typescript
outputFiles['output.md'] = markdownToBytes(
  buildOutputMarkdown(sections, request.file.name, totalFiles, convertedFiles, skippedFiles, failedFiles),
)
```

And change the `includeConversionReport` check (which was gated by `request.options.includeConversionReport`) — since it's always true, remove the conditional:

```typescript
outputFiles['conversion-report.md'] = markdownToBytes(
  createConversionReportMarkdown(report),
)
```

- [ ] **Step 3: Remove ponytail comments**

In `processZipStream`, remove:
```typescript
// ponytail: always include markdown as-is in combined output
```

In `startConversion`, remove the empty `if (entry.extension === 'md')` block:

```typescript
// Delete this entire block:
if (entry.extension === 'md') {
  // ponytail: always include markdown as-is in combined output
}
```

- [ ] **Step 4: Remove `options` reference from `startConversion`**

Replace:
```typescript
async function startConversion(request: Extract<WorkerRequest, { type: 'START_CONVERSION' }>) {
```
With:
```typescript
async function startConversion(request: WorkerRequest & { type: 'START_CONVERSION' }) {
```

Remove `options: request.options` from `processZipStream` call.

In `processZipStream`'s `StreamParams`, remove `options: ConversionOptions` and change `params.options.preserveFolderStructure` to `true` literal.

- [ ] **Step 5: Run `npx tsc --noEmit` to verify**

```bash
cd /Users/irawananggie/Documents/Zipto && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/worker/conversion.worker.ts
git commit -m "feat: add summary header, TOC, and separators to output.md"
```

---

### Task 4: Enhanced Conversion Report

**Files:**
- Modify: `src/report/createConversionReport.ts`

**Interfaces:**
- Consumes: `ConversionReport` type (unchanged)
- Produces: Rich Markdown report string

- [ ] **Step 1: Rewrite `createConversionReportMarkdown` with richer formatting**

```typescript
export function createConversionReportMarkdown(report: ConversionReport): string {
  const failedFiles = report.results.filter((r) => r.status === 'failed')
  const skippedFiles = report.results.filter((r) => r.status === 'skipped')

  const statusIcon = report.cancelled ? '⚠️' : report.completed ? '✅' : '❌'
  const statusText = report.cancelled ? 'Cancelled' : report.completed ? 'Completed' : 'Failed'

  const parts: string[] = [
    `# Conversion Report`,
    '',
    `**Source ZIP:** \`${report.sourceZipName}\``,
    `**Converted at:** ${report.convertedAt}`,
    `**Status:** ${statusIcon} ${statusText}`,
    '',
    `## Summary`,
    '',
    `| Metric | Count |`,
    `|--------|------:|`,
    `| Total files | ${report.totalFiles} |`,
    `| Processed | ${report.processedFiles} |`,
    `| Converted | ${report.convertedFiles} |`,
    `| Skipped | ${report.skippedFiles} |`,
    `| Failed | ${report.failedFiles} |`,
    '',
  ]

  parts.push(`## Failed Files (${failedFiles.length})`)
  parts.push('')
  if (failedFiles.length === 0) {
    parts.push('None.')
  } else {
    parts.push(...failedFiles.map((f) => {
      return `- \`${escapeBackticks(f.sourcePath)}\` — ${f.reason ?? 'Unknown error'}`
    }))
  }
  parts.push('')

  parts.push(`## Skipped Files (${skippedFiles.length})`)
  parts.push('')
  if (skippedFiles.length === 0) {
    parts.push('None.')
  } else {
    parts.push(...skippedFiles.map((f) => {
      return `- \`${escapeBackticks(f.sourcePath)}\` — ${f.reason ?? 'Unknown reason'}`
    }))
  }
  parts.push('')

  parts.push(`## Unsafe Paths (${report.unsafePaths.length})`)
  parts.push('')
  if (report.unsafePaths.length === 0) {
    parts.push('None.')
  } else {
    parts.push(...report.unsafePaths.map((p) => {
      return `- \`${escapeBackticks(p.path)}\` — ${p.reason} (${p.action})`
    }))
  }
  parts.push('')

  if (report.warnings.length > 0) {
    parts.push(`## Warnings`)
    parts.push('')
    parts.push(...report.warnings.map((w) => `- ${w}`))
    parts.push('')
  }

  parts.push('---')
  parts.push('')
  parts.push('*All files were processed locally in the browser. No data was uploaded to any server.*')

  return parts.join('\n')
}
```

Make sure `escapeBackticks` function is kept (already exists in the file).

- [ ] **Step 2: Remove unused `formatResults`, `formatUnsafePaths`, `formatWarnings` functions**

Delete these three functions since they're no longer called.

- [ ] **Step 3: Run `npx tsc --noEmit` to verify**

```bash
cd /Users/irawananggie/Documents/Zipto && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/report/createConversionReport.ts
git commit -m "feat: enhance conversion report with table summary and cleaner formatting"
```

---

### Task 5: UX Improvements — App.tsx & ResultPanel

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/components/ResultPanel.tsx`

**Interfaces:**
- Consumes: `ConversionReport` type, `ConversionStatus`
- Produces: Better UX with preview, skip notice, correct filename

- [ ] **Step 1: Fix outputFilename state and remove defaultOptions**

In `App.tsx`:

Remove `defaultOptions` const:
```typescript
// Delete:
const defaultOptions: ConversionOptions = {
  preserveFolderStructure: true,
  includeConversionReport: true,
}
```

Change `outputFilename` state initial value:
```typescript
const [outputFilename, setOutputFilename] = useState('')
```

Remove `ConversionOptions` import from the import list.

Update `startConversion` to not pass `options`:
```typescript
const request: WorkerRequest = {
  type: 'START_CONVERSION',
  file: sourceFile,
}
```

Remove unused imports: `ConversionOptions` (from types import), `WorkerRequest` (keep — it's used).

- [ ] **Step 2: Add `outputContent` state for preview**

Add to App component state:
```typescript
const [outputContent, setOutputContent] = useState<string>()
```

Pass it to ResultPanel:
```typescript
{status === 'completed' || status === 'cancelled') && report ? (
  <ResultPanel
    status={status}
    report={report}
    downloadUrl={downloadUrl}
    outputFilename={outputFilename}
    outputContent={outputContent}
  />
) : null}
```

In `handleWorkerResult`, extract content from the blob for preview:
```typescript
async function handleWorkerResult(
  nextStatus: Extract<ConversionStatus, 'completed' | 'cancelled'>,
  outputBlob: Blob | undefined,
  nextReport: ConversionReport | undefined,
) {
  setStatus(nextStatus)
  setCancelRequested(false)

  if (nextReport) {
    setReport(nextReport)
    setProgress(reportToProgress(nextReport, nextStatus))
  }

  if (outputBlob && sourceFile) {
    const url = URL.createObjectURL(outputBlob)
    downloadUrlRef.current = url
    setDownloadUrl(url)
    setOutputFilename(createOutputFilename(sourceFile.name))

    // Preview: read output.md content from the ZIP blob
    if (status === 'completed' && nextReport) {
      try {
        const preview = await extractPreviewFromZip(outputBlob)
        setOutputContent(preview)
      } catch {
        // Preview is optional
      }
    }
  }

  cleanupWorker()
}
```

Add the preview extraction function:
```typescript
async function extractPreviewFromZip(blob: Blob): Promise<string | undefined> {
  try {
    const { unzipSync, strFromU8 } = await import('fflate')
    const data = new Uint8Array(await blob.arrayBuffer())
    const unzipped = unzipSync(data)
    const mdFile = unzipped['output.md']
    if (mdFile) {
      const text = strFromU8(mdFile)
      // Return first 500 chars for preview
      return text.slice(0, 500) + (text.length > 500 ? '\n\n...' : '')
    }
  } catch {
    // silently fail
  }
  return undefined
}
```

- [ ] **Step 3: Update ResultPanel props and add preview + skip notice**

```typescript
type ResultPanelProps = {
  status: Extract<ConversionStatus, 'completed' | 'cancelled'>
  report: ConversionReport
  downloadUrl?: string
  outputFilename: string
  outputContent?: string
}

export function ResultPanel({
  status,
  report,
  downloadUrl,
  outputFilename,
  outputContent,
}: ResultPanelProps) {
  return (
    <section className="panel result-panel">
      <div className="panel-header">
        <div>
          <p className="section-label">Result</p>
          <h2>{status === 'completed' ? 'Conversion completed' : 'Conversion cancelled'}</h2>
        </div>
        {downloadUrl ? (
          <a className="button button-primary" href={downloadUrl} download={outputFilename}>
            Download output ZIP
          </a>
        ) : null}
      </div>

      <dl className="summary-grid">
        <div>
          <dt>Total files</dt>
          <dd>{report.totalFiles.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Processed</dt>
          <dd>{report.processedFiles.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Converted</dt>
          <dd>{report.convertedFiles.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Skipped</dt>
          <dd>{report.skippedFiles.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Failed</dt>
          <dd>{report.failedFiles.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Unsafe paths</dt>
          <dd>{report.unsafePaths.length.toLocaleString()}</dd>
        </div>
      </dl>

      {report.skippedFiles > 0 ? (
        <div className="notice notice-warning">
          <strong>{report.skippedFiles} file{report.skippedFiles !== 1 ? 's' : ''} skipped.</strong>
          {' '}Check <code>conversion-report.md</code> in the output ZIP for details.
        </div>
      ) : null}

      {outputContent ? (
        <div className="output-preview">
          <h3>Output preview</h3>
          <pre className="preview-content"><code>{outputContent}</code></pre>
        </div>
      ) : null}

      <div className="report-summary">
        <h3>Conversion report</h3>
        <p>
          The output ZIP includes <code>conversion-report.md</code> with skipped
          files, failed files, unsafe paths, and warnings.
        </p>
        {report.warnings.length > 0 ? (
          <ul>
            {report.warnings.slice(0, 5).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Add CSS for preview block in `app.css`**

Add at the bottom of `src/app/styles/app.css`:

```css
.output-preview {
  display: grid;
  gap: 8px;
}

.output-preview h3 {
  color: var(--text);
}

.preview-content {
  max-height: 280px;
  overflow: auto;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-strong);
  font-size: 0.85rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}
```

- [ ] **Step 5: Run `npx tsc --noEmit` to verify**

```bash
cd /Users/irawananggie/Documents/Zipto && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/App.tsx src/app/components/ResultPanel.tsx src/app/styles/app.css
git commit -m "feat: add output preview, skip notice, fix output filename"
```

---

### Task 6: Final Cleanup — Remove Ponytail Comments & Verify

**Files:**
- Verify: all source files have `// ponytail:` removed
- Modify: any remaining files with ponytail comments

- [ ] **Step 1: Search for remaining ponytail comments**

```bash
cd /Users/irawananggie/Documents/Zipto && rg "ponytail" src/ --no-heading
```
Expected: No matches.

- [ ] **Step 2: Full build check**

```bash
cd /Users/irawananggie/Documents/Zipto && npm run build 2>&1
```
Expected: Build succeeds with no errors.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: remove ponytail comments, final cleanup"
```

---

## Summary of Changes

| File | Lines Changed | Nature |
|------|--------------|--------|
| `src/types/conversion.ts` | ~5 removed | Remove `ConversionOptions` type |
| `src/converters/index.ts` | Full rewrite | Smart extension routing |
| `src/worker/conversion.worker.ts` | ~40 added, ~20 removed | Summary, TOC, separator, cleanup |
| `src/report/createConversionReport.ts` | ~60 changed | Rich report formatting |
| `src/app/App.tsx` | ~20 changed | Remove options, add preview extraction |
| `src/app/components/ResultPanel.tsx` | ~30 changed | Add preview + skip notice |
| `src/app/styles/app.css` | ~15 added | Preview block styles |
