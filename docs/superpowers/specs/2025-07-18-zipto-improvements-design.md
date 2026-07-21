# Zipto — Comprehensive Improvements Design

## Overview

Zipto is a local-first PWA that converts files inside ZIP archives into a single Markdown file (`output.md`), preserving folder structure through headings. This spec covers targeted improvements to core functionality, output quality, code cleanliness, performance, and UX.

## Scope

All changes are incremental refactors — no full rewrites. Every file modification preserves existing behavior while improving correctness, safety, readability, and user experience.

---

## 1. Core Converter Logic

**Files:** `src/converters/index.ts`, `src/converters/txtToMarkdown.ts`, `src/converters/codeBlockToMarkdown.ts`

### Current Problems
- All files (including `.md` and `.txt`) go into code blocks.
- The `isSupportedExtension` function always returns `true` via a ponytail comment.
- `txtToMarkdown` exists but is never wired in.
- No special handling for Markdown files (they should be copied as-is).

### Desired Behavior

| Extension | Strategy |
|-----------|----------|
| `.md`     | Copy content as-is (no code fence). Preserve existing Markdown. |
| `.txt`    | Copy content as-is (no code fence). |
| `.html`   | Convert via Turndown (already implemented). |
| `.csv`    | Convert to Markdown table via PapaParse (already implemented). |
| `.json`   | Pretty-print inside `json` code block (already implemented). |
| other     | Code block with extension as language hint, or `text` for unknown. |

### Changes
- `index.ts`: Replace `convertToMarkdown` to check extensions in order: `md`/`txt` → as-is, `html` → existing html converter, `csv` → existing csv converter, `json` → existing json converter, else → code block.
- Remove `isSupportedExtension` (no longer needed; all files are supported implicitly).
- `txtToMarkdown.ts`: Keep as a simple identity function; wire it in `index.ts`.
- `codeBlockToMarkdown.ts`: No changes needed.

---

## 2. Output Markdown Structure

**Files:** `src/worker/conversion.worker.ts`, `src/report/createConversionReport.ts`

### Current Problems
- `output.md` is just sections joined by `\n\n` — no header, no summary, no TOC.
- No separation between file sections beyond the heading.

### Desired Output Structure

```markdown
# ZIP to Markdown Output

**Source ZIP:** `project.zip`
**Converted at:** 2025-07-18 10:30
**Total files:** 42 | **Converted:** 38 | **Skipped:** 3 | **Failed:** 1

## Table of Contents

- [src/index.ts](#srcindexts)
- [src/utils/helpers.ts](#srcutilshelpersts)
...

---

## src/index.ts

[file content]

---

## src/utils/helpers.ts

[file content]
...
```

### Changes
- **`conversion.worker.ts`**: After all sections are collected, prepend a summary block (source ZIP name, timestamp, counts) and a TOC generated from the section headings. Join everything with `\n\n---\n\n` separators.
- TOC entries link to headings using GitHub-style anchors (lowercase, spaces → hyphens, remove dots).

---

## 3. Conversion Report

**Files:** `src/report/createConversionReport.ts`

### Current Problems
- Report is functional but minimal.
- Summary section is short; could be more readable.

### Desired Improvements
- Rich summary with status icon/emoji and clear counts.
- Separated sections for Failed, Skipped, Unsafe Paths.
- Refined formatting with bold labels, code paths, consistent indentation.
- The "Notes" section lists warnings as a bullet list.

### Changes
- Enhance `createConversionReportMarkdown` with cleaner formatting.
- Group results clearly. Use `**label:** value` pattern for the summary.
- Keep all existing data fields.

---

## 4. TypeScript Typing & Code Cleanliness

**Files:** Multiple

### Current Problems
- `// ponytail:` comments exist in `index.ts` and `conversion.worker.ts`.
- Some functions lack explicit return types.
- `any` type used occasionally (e.g., `unknown` would be better in some places).

### Changes
- Remove all `// ponytail:` comments.
- Add explicit return types where missing.
- Clean up imports.
- Rename `textDecoder` to `TEXT_DECODER` for const naming convention.

---

## 5. Performance & Memory

### Current Status
- The worker already streams ZIP parsing with `pushChunks` (64KB chunks) and yields with `setTimeout`.
- Output files are collected in memory as a `sections: string[]`.
- The entire ZIP is read into memory via `arrayBuffer()` first.

### Considerations
- For large ZIPs, `arrayBuffer()` is unavoidable with fflate's API. An alternative would be using `Blob.stream()` with a streaming unzip library, but fflate doesn't support streaming natively.
- Keep the current approach but document the limitation in the code.
- No changes needed to the streaming logic itself — it already yields control.

---

## 6. User Experience Improvements

**Files:** `src/app/App.tsx`, `src/app/components/ResultPanel.tsx`

### Current Problems
- No preview of `output.md` before download.
- No special notification when many files are skipped.
- Output filename is wrong (`markdown-output.zip` → actually `{name}.md` from `createOutputFilename`, but `outputFilename` state is initialized to `markdown-output.zip`).

### Changes
- Fix initial `outputFilename` state: remove hardcoded value, derive from source file when available.
- Add a short preview snippet in `ResultPanel` showing first ~200 chars of output if available.
- Add skip-files notice: if `report.skippedFiles > 0`, show a banner in `ResultPanel`.

---

## 7. ConversionOptions simplification

**Files:** `src/types/conversion.ts`, `src/worker/conversion.worker.ts`

### Current Problems
- `ConversionOptions` has `preserveFolderStructure: true` (always true, literal type) and `includeConversionReport: true` — these are effectively constants, not configurable options.

### Changes
- Remove `ConversionOptions` type. Hardcode the behavior (preserve folder structure, always include report).
- Simplify the worker message types accordingly.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/types/conversion.ts` | Remove `ConversionOptions`, strengthen typing |
| `src/converters/index.ts` | Rewire converter routing, remove `isSupportedExtension` |
| `src/converters/txtToMarkdown.ts` | Keep as identity (already correct) |
| `src/worker/conversion.worker.ts` | Add summary/TOC, separator, remove ponytail comments |
| `src/report/createConversionReport.ts` | Enhanced report formatting |
| `src/app/App.tsx` | Remove `defaultOptions`, fix output filename, minor cleanup |
| `src/app/components/ResultPanel.tsx` | Add preview + skip notice |
| `src/zip/readZip.ts` | Minor cleanup |

## Non-Goals

- Adding new file format support beyond current converters.
- Replacing fflate with another ZIP library.
- Adding a dark mode.
- Internationalization (i18n).
- End-to-end tests (unit test setup is not in place).

---

## Self-Review Checklist

- [x] No placeholders or TODOs in this spec.
- [x] Architecture matches feature descriptions.
- [x] Scope is focused on one implementation plan.
- [x] No ambiguous requirements — each change is clearly described.
