---
name: office-docs
description: Create and edit Word documents, PowerPoint slide decks, Excel spreadsheets, and PDFs using open-source libraries (docx, pptxgenjs, openpyxl/pandas, reportlab/pypdf/pdfplumber), with markitdown for inspection and LibreOffice/Poppler/pandoc for conversion and rendering. Use whenever a deliverable needs to be a .docx, .pptx, .xlsx, or .pdf file rather than markdown/plaintext — proposals, pitches, SOWs, specs, reports, decks, and spreadsheets.
---

# Office Documents (docx, pptx, xlsx, pdf)

Create, edit, and convert Word documents, PowerPoint decks, Excel
spreadsheets, and PDFs. This skill is tool-focused, not a persona — it
covers the libraries and workflow needed to actually produce these file
types as real, openable deliverables.

Node dependencies (`docx`, `pptxgenjs`) live in the repo root
`package.json`; Python dependencies (`openpyxl`, `pandas`, `markitdown`,
`Pillow`, `defusedxml`, `lxml`, `pypdf`, `pdfplumber`, `reportlab`) live in
the repo root `pyproject.toml`. Install both with `task install`
(see the README's "Document tooling" section for the OS-level tools this
skill also depends on: `pandoc`, LibreOffice, Poppler, `qpdf`).

## Core Rules

**Always inspect an existing file with `markitdown` before editing it**,
and spot-check generated output the same way — don't assume a file's
content or structure without reading it back.

**docx**: always define and use a **style set** (Title, Heading 1/2/3,
Body/Normal, Quote, Caption, plus Emphasis/Strong character styles) via the
`docx` package's `styles` option before adding content. Never apply one-off
inline `bold`/`size`/`color`/`italics` runs for things that are
structurally headings, quotes, or emphasis — use the named style so the
document stays consistent and a human can re-style it later by editing one
definition instead of hunting through every paragraph.

**pptx**: define a consistent slide master/theme (fonts, colors, layout)
before adding slides — don't style each slide ad hoc.

**xlsx**: use `openpyxl` for formulas/formatting/structure and `pandas` for
bulk data in/out; always recalculate formulas via LibreOffice headless
before delivering, since `openpyxl` never evaluates them.

**pdf**: pick the right tool for the job — `reportlab` to generate from
scratch (with its own defined `ParagraphStyle` set), `pypdf` for
merges/splits/metadata/forms, `pdfplumber` for text/table extraction.

**Always validate and render the output** (LibreOffice headless → PDF →
`pdftoppm` preview, or direct inspection) before declaring a deliverable
done — never claim a document is ready without having actually looked at
the rendered result.

## Guide Routing

- Read [create-docx.md](./guides/create-docx.md) for building/structuring a
  new Word document — the style-set requirement is detailed here.
- Read [create-pptx.md](./guides/create-pptx.md) for building a slide deck
  with a defined master/theme.
- Read [create-xlsx.md](./guides/create-xlsx.md) for building a spreadsheet
  with `openpyxl`/`pandas`, named styles, and formula recalculation.
- Read [create-pdf.md](./guides/create-pdf.md) for generating from scratch
  with `reportlab` vs. manipulating with `pypdf` vs. extracting with
  `pdfplumber`.
- Read [inspect-convert-and-render.md](./guides/inspect-convert-and-render.md)
  for the shared cross-format workflow: `markitdown` inspection, `pandoc`
  conversion, LibreOffice rendering/recalculation, and Poppler PDF preview
  — needed regardless of which format you're working with.

## Quick Reference

- [style-set-template.md](./references/style-set-template.md) — copy-pasteable
  default docx style set (Title/Heading 1-3/Normal/Quote/Caption/Emphasis/Strong).
- [docx-api-quick-reference.md](./references/docx-api-quick-reference.md)
- [pptx-api-quick-reference.md](./references/pptx-api-quick-reference.md)
- [xlsx-api-quick-reference.md](./references/xlsx-api-quick-reference.md)
- [pdf-api-quick-reference.md](./references/pdf-api-quick-reference.md)
- [final-check.md](./references/final-check.md) — pre-delivery checklist.

## Final Check

Before delivering any generated or edited document, verify it against
[final-check.md](./references/final-check.md).
