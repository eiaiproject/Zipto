# Zipto Design Direction

Single-page local-first tool: drop a ZIP, get one Markdown file plus a PDF export. No marketing sections, no accounts, no themes.

Dial: ENERGY 1 / RHYTHM 2 / MOTION 1

## Identity

Warm paper tool, not a tech dashboard. Linen background, clay ink, one terracotta accent. Panels are the product: dropzone, ZIP summary, live progress, result. Each panel head has its own shape (dropzone split row, summary filename rule, progress live headline, result tick row) so screens stay scannable without decoration.

## Palette

- Base: linen `oklch(95% 0.012 65)`, cream surfaces. Reason: paper feel that keeps long file lists readable.
- Ink: dark clay text, mid clay muted. Reason: warm neutrals with AA contrast (text 12.70, muted 5.65 on linen).
- Accent: terracotta, used only at the key action and live status. Reason: one deliberate accent marks convert, progress, and focus.
- Status tones stay in the warm family (brick danger, ochre warning) so alerts read without a second palette.

## Typography

- Sora for display and body, system sans fallback, monospace for paths, code, and previews. Reason: one humanist sans keeps tool copy calm; mono marks machine text (paths, output) as machine text.
- Small caps labels (`Current file`, eyebrows) stay at 0.06-0.08em tracking. Reason: quiet section markers, never headline-style wide tracking.

## Motif

Hairline warm borders plus tabular numerals in every stat cell. Reason: the repeated 1px clay rule and aligned counts are the product fingerprint across summary, progress, and result.

## Motion

Hover and state transitions only (140-200ms ease-out), progress bar eases width. Reason: a conversion tool reports state; nothing loops, floats, or reveals on scroll. Honors `prefers-reduced-motion`.

## Theme

Light only. Reason: the paper identity is the brand; a dark garmen would need its own warm ramp, which does not exist yet.

## Icon

Terracotta field with an ivory Z (ZIP initial), matching the SVG brand mark. Reason: one glyph reads at 192px and 512px and stays legible as a maskable icon.
