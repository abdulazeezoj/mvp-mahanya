# Create or Edit a PDF

Uses the Python `reportlab`, `pypdf`, and `pdfplumber` packages.

## Picking the right tool

- **`reportlab`** — generating a PDF from scratch (a report, a certificate,
  a form). Use `SimpleDocTemplate` with `Paragraph`/`Table`/`Spacer` flowables
  and a defined `ParagraphStyle` set (Title/Heading/Body, same reasoning as
  docx/pptx/xlsx — define styles once, reuse them) rather than the lower-level
  `Canvas` API unless you need precise absolute positioning (e.g. a
  pre-printed form overlay).
- **`pypdf`** — manipulating existing PDFs: merging, splitting, rotating
  pages, reading/writing metadata, filling simple form fields.
- **`pdfplumber`** — extracting content from an existing PDF: text, tables,
  and layout/position data. Read-only; use `pypdf` if the extracted content
  needs to feed back into a modified PDF.

## Common workflows

- **Generate a report from scratch** — build the content as a list of
  flowables against a defined style set, call `doc.build(story)`.
- **Merge/split** — `PdfWriter` + `PdfReader`, appending or slicing pages.
- **Extract text/tables** — `pdfplumber.open(path)`, iterate `.pages`, use
  `.extract_text()` / `.extract_tables()`.
- **Fill a form** — prefer `pypdf`'s form-filling if the PDF already has
  AcroForm fields; don't hand-place text over a flattened form image.

See [references/pdf-api-quick-reference.md](../references/pdf-api-quick-reference.md)
for the concrete API constructs.

## Before finishing

Validate the output — see
[inspect-convert-and-render.md](./inspect-convert-and-render.md) — and run
through [references/final-check.md](../references/final-check.md).
