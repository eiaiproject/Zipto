# ZIP to Markdown Converter

A local-first PWA that converts files inside ZIP archives into Markdown (plus a PDF export) directly in the browser.

All file processing happens on the user's device. Files are not uploaded to a server.

## Demo

Production: `https://zipto.pages.dev`

## Features

- Convert ZIP archives into a single Markdown file, with an optional PDF export.
- No artificial ZIP size limit.
- No artificial file count limit.
- Process files locally in the browser.
- Validate uploads by ZIP magic bytes, not just the file name.
- Show each source file's original path as a heading in the combined output.
- Convert 100+ text and code formats (TXT, MD/MDX, HTML, CSV/TSV, JSON/JSONC/JSON5, XML, YAML, LOG, JS/TS, Python, Go, Rust, Java, CSS, SQL, shell scripts, and more).
- Skip unsupported files without stopping the batch.
- Embed a conversion report as the first section of the output Markdown file.
- Run conversion in a Web Worker.
- Generate the PDF in a separate worker so the UI never freezes.
- Show real-time progress with an output preview.
- Cancel long-running conversions.
- Installable as a PWA.
- Works offline after the first load.

## Supported Formats

| Input format | Output | Behavior |
| --- | --- | --- |
| `.txt`, `.md`, `.markdown`, `.mdx`, `.rst` | `.md` | Copies text as-is. |
| `.csv` | `.md` | Converts rows to a Markdown table. |
| `.tsv` | `.md` | Converts tab-separated rows to a Markdown table. |
| `.json`, `.jsonc`, `.json5` | `.md` | Preserves the original text inside a fenced code block, with a warning when the JSON is invalid. |
| `.html`, `.htm`, `.xhtml` | `.md` | Preserves the original markup inside an HTML fenced code block. |
| `.xml` | `.md` | Wraps content in an XML fenced code block. |
| `.yaml`, `.yml` | `.md` | Wraps content in a YAML fenced code block. |
| `.log` | `.md` | Wraps content in a LOG fenced code block. |
| Code and config files (`.js`, `.ts`, `.py`, `.go`, `.rs`, `.java`, `.css`, `.sql`, `.sh`, `.toml`, `.ini`, …) | `.md` | Wraps content in a fenced code block tagged with the file's language. |
| Extensionless and dotfiles (`Makefile`, `Dockerfile`, `.gitignore`, `.env`) | `.md` | Treated as plain text. |

Unsupported files are skipped and listed in the conversion report section of the output file.

## Privacy & Security

All files are processed locally in your browser. Nothing is uploaded to a server.

The app does not call remote APIs, send file contents to analytics, or use CDN-hosted conversion libraries. ZIP reading, file conversion, report generation, and output Markdown file creation all run in the browser.

The app also sanitizes ZIP entry paths. Unsafe paths such as `../../secret.txt`, absolute paths, and Windows drive paths are not written as-is and are recorded in the conversion report.

## No Artificial Limits

This app does not enforce artificial ZIP size, file count, folder depth, or extracted-size limits.

Conversion proceeds as far as the user's browser, device memory, CPU, storage, and ZIP/conversion libraries can support. Very large archives may still be slow or fail because of browser or device constraints. The app shows progress and supports cancellation for long-running conversions.

## Tech Stack

- Vite
- React
- TypeScript
- Web Worker
- fflate
- PapaParse
- jsPDF
- vite-plugin-pwa

## How It Works

1. The React app handles upload, drag and drop, ZIP summary display, progress UI, cancellation controls, output preview, and download buttons.
2. Uploads are validated by file name, MIME type, and ZIP magic bytes, then ZIP metadata is read locally so the user can review the archive before converting.
3. Conversion runs in `src/worker/conversion.worker.ts`.
4. The worker reads ZIP entries, sanitizes paths, converts supported files, skips unsupported files, creates the conversion report, and generates the output Markdown file.
5. The generated output Markdown file places the conversion report first, followed by one section per converted file, with each section headed by the file's original path.
6. The app shows a short preview of the generated Markdown.
7. PDF export runs on demand in `src/worker/pdf.worker.ts`, which renders the Markdown via `src/pdf/markdownToPdf.ts` without blocking the UI.
8. The service worker precaches the app shell so the app opens offline after the first successful load. The PDF engine (~800 KB) is cached on first PDF export instead, keeping the initial install small.

## Project Structure

```text
src/
├── app/
│   ├── App.tsx
│   ├── components/
│   └── styles/
├── converters/
├── pdf/
├── report/
├── types/
├── worker/
│   ├── conversion.worker.ts
│   └── pdf.worker.ts
└── zip/
```

Important files:

- `src/app/App.tsx` - main UI state and worker lifecycle.
- `src/worker/conversion.worker.ts` - ZIP conversion pipeline.
- `src/worker/pdf.worker.ts` - off-thread PDF generation.
- `src/pdf/markdownToPdf.ts` - Markdown to PDF renderer.
- `src/converters/` - format-specific Markdown converters.
- `src/zip/sanitizePath.ts` - ZIP path safety rules.
- `src/report/createConversionReport.ts` - Markdown report generation.
- `vite.config.ts` - Vite and PWA configuration.
- `DESIGN.md` - design direction, dials, and visual reasons.

## Getting Started

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

Lint:

```bash
npm run lint
```

## Deployment

### Cloudflare Pages (recommended)

The app is ready for Cloudflare Pages.

**Option A — via Git (automatic):**

1. Push to GitHub.
2. In Cloudflare Dashboard → Pages → Create a project → Connect your Git repo.
3. Use these settings:

   | Setting | Value |
   |---|---|
   | Framework preset | Vite |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | (project root) |

4. Set environment variable:

   ```text
   NODE_VERSION=22.12.0
   ```

   Vite requires Node `^20.19.0 || >=22.12.0`, so Cloudflare Pages should use a compatible Node version.

**Option B — via wrangler CLI:**

```bash
npm run deploy
```

Make sure you are logged in:

```bash
npx wrangler login
```

### Files included for Cloudflare

| File | Purpose |
|---|---|
| `public/_redirects` | SPA fallback — all routes serve `index.html` |
| `public/_headers` | Security headers + cache policy for assets |
| `wrangler.toml` | Wrangler CLI project config |

## Testing

Run static checks:

```bash
npm run lint
npm run build
```

Manual checklist:

- Upload a valid `.zip` file with the file picker.
- Drag and drop a valid `.zip` file.
- Select a non-ZIP file and confirm a clear error is shown.
- Confirm the ZIP summary shows filename, compressed size, detected entries, detected files, and unsafe path count.
- Convert `.txt`, `.md`, `.html`, `.csv`, `.tsv`, `.json`, `.xml`, `.yaml`, `.yml`, `.log`, plus a code file and an extensionless file.
- Confirm a renamed non-ZIP file is rejected by the signature check.
- Confirm unsupported files are skipped and recorded in the conversion report.
- Confirm paths containing `../` are skipped and listed under unsafe paths.
- Confirm the output file is a single `.md` file with the conversion report first.
- Confirm each converted file's original path appears as a heading in the output.
- Confirm the output preview shows converted content, not the report footer.
- Download the PDF export and confirm it renders tables and code blocks.
- Start a large conversion and cancel it.
- Build and preview the app, load it once, then confirm it opens offline in a supported browser.

## Limitations

- DOCX input and PDF text extraction are not included in the MVP (PDF output is supported).
- OCR is not included.
- Files are decoded as text; unusual legacy encodings may not render perfectly.
- Unsupported file types are skipped and listed in the conversion report section of the output file.
- Repeated headings in the output (from same-named files in different directories) are cosmetic and not a collision.
- Very large ZIP files may still be constrained by browser memory, CPU, storage, and device capabilities.
- Very large outputs (over ~10 MB) show a warning before PDF export, and PDF generation times out after 120 seconds.

## Roadmap

- Add optional DOCX conversion.
- Add optional PDF text extraction.
- Add browser-based integration tests for conversion flows.
- Add a screenshot and refine the PWA icon set after deployment.

## License

No license has been selected yet.
