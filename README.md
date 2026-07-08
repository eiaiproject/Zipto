# ZIP to Markdown Converter

A local-first PWA that converts files inside ZIP archives into Markdown directly in the browser.

All file processing happens on the user's device. Files are not uploaded to a server.

## Demo

No public demo URL is configured yet.

When deployed, add the production URL here.

## Features

- Convert ZIP archives into Markdown.
- No artificial ZIP size limit.
- No artificial file count limit.
- Process files locally in the browser.
- Preserve the original folder structure.
- Convert TXT, MD, HTML, CSV, JSON, XML, YAML, and LOG files.
- Skip unsupported files without stopping the batch.
- Generate `conversion-report.md`.
- Run conversion in a Web Worker.
- Show real-time progress.
- Cancel long-running conversions.
- Installable as a PWA.
- Works offline after the first load.

## Supported Formats

| Input format | Output | Behavior |
| --- | --- | --- |
| `.txt` | `.md` | Copies text as-is. |
| `.md` | `.md` | Copies Markdown as-is. |
| `.html`, `.htm` | `.md` | Converts common HTML elements to Markdown. |
| `.csv` | `.md` | Converts rows to a Markdown table. |
| `.json` | `.md` | Pretty-prints valid JSON inside a fenced code block. |
| `.xml` | `.md` | Wraps content in an XML fenced code block. |
| `.yaml`, `.yml` | `.md` | Wraps content in a YAML fenced code block. |
| `.log` | `.md` | Wraps content in a LOG fenced code block. |

Unsupported files are skipped and listed in `conversion-report.md`.

## Privacy & Security

All files are processed locally in your browser. Nothing is uploaded to a server.

The app does not call remote APIs, send file contents to analytics, or use CDN-hosted conversion libraries. ZIP reading, file conversion, report generation, and output ZIP creation all run in the browser.

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
- Turndown
- PapaParse
- vite-plugin-pwa

## How It Works

1. The React app handles upload, drag and drop, ZIP summary display, progress UI, cancellation controls, and download links.
2. ZIP metadata is read locally so the user can review the archive before converting.
3. Conversion runs in `src/worker/conversion.worker.ts`.
4. The worker reads ZIP entries, sanitizes paths, converts supported files, skips unsupported files, creates `conversion-report.md`, and generates the output ZIP.
5. The generated output ZIP preserves the original folder structure for converted Markdown files.
6. The service worker precaches the app shell so the app opens offline after the first successful load.

## Project Structure

```text
src/
├── app/
│   ├── App.tsx
│   ├── components/
│   └── styles/
├── converters/
├── report/
├── types/
├── worker/
└── zip/
```

Important files:

- `src/app/App.tsx` - main UI state and worker lifecycle.
- `src/worker/conversion.worker.ts` - ZIP conversion pipeline.
- `src/converters/` - format-specific Markdown converters.
- `src/zip/sanitizePath.ts` - ZIP path safety rules.
- `src/report/createConversionReport.ts` - Markdown report generation.
- `vite.config.ts` - Vite and PWA configuration.

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

The app is suitable for static hosting.

Cloudflare Pages settings:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | Project root |

Recommended environment variable:

```text
NODE_VERSION=22.12.0
```

Vite requires Node `^20.19.0 || >=22.12.0`, so Cloudflare Pages should use a compatible Node version.

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
- Convert `.txt`, `.md`, `.html`, `.csv`, `.json`, `.xml`, `.yaml`, `.yml`, and `.log` files.
- Confirm unsupported files are skipped and recorded in `conversion-report.md`.
- Confirm paths containing `../` are skipped and listed under unsafe paths.
- Confirm the output ZIP preserves folder structure.
- Confirm the output ZIP includes `conversion-report.md`.
- Start a large conversion and cancel it.
- Build and preview the app, load it once, then confirm it opens offline in a supported browser.

## Limitations

- DOCX and PDF conversion are not included in the MVP.
- OCR is not included.
- Files are decoded as text; unusual legacy encodings may not render perfectly.
- Unsupported file types are skipped and listed in `conversion-report.md`.
- If multiple input files would write the same Markdown path, later files get a numbered output filename and a report warning.
- Very large ZIP files may still be constrained by browser memory, CPU, storage, and device capabilities.

## Roadmap

- Add optional DOCX conversion.
- Add optional PDF text extraction.
- Add browser-based integration tests for conversion flows.
- Add a public demo URL and screenshot after deployment.

## License

No license has been selected yet.
