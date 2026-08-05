# Inspect, Convert, and Render

The shared cross-format workflow used regardless of which document type
you're working with.

## Inspecting a file with markitdown

Before editing an existing docx/pptx/xlsx/pdf, or before declaring a
generated one finished, convert it to Markdown for a quick read:

```bash
python3 -m markitdown path/to/file.docx
```

This works the same way for `.pptx`, `.xlsx`, and `.pdf`. Use it to confirm
structure (headings, tables, slide text) and catch obviously wrong or
missing content before doing anything more expensive (opening in
LibreOffice, rendering an image preview).

## Converting docx with pandoc

For format conversion involving docx (e.g. docx ↔ Markdown, docx ↔ HTML):

```bash
pandoc input.docx -o output.md
pandoc input.md -o output.docx
```

Pandoc is a general document converter; prefer it over hand-rolling
conversion logic whenever the target/source format pair is one it supports.

## Rendering and recalculating with LibreOffice

LibreOffice headless (`soffice`) is used for two things:

1. **Rendering a docx/pptx/xlsx to PDF** for a visual check or a preview
   image:
   ```bash
   soffice --headless --convert-to pdf path/to/file.docx
   ```
2. **Recalculating xlsx formulas** so the delivered file shows computed
   values rather than the raw formula text (`openpyxl` does not evaluate
   formulas itself). There is no dedicated `--calc-recalc` CLI flag —
   instead, round-trip the file through Calc by converting it to xlsx
   again; opening triggers evaluation, and the save writes the computed
   values back into the formula cells' cached `<v>` elements:
   ```bash
   soffice --headless --norestore --convert-to xlsx --outdir path/to/dir path/to/file.xlsx
   ```
   This overwrites/creates `file.xlsx` in `--outdir` with fresh cached
   values. If a particular LibreOffice version doesn't recalculate
   everything on a plain open (some setups only recalculate shared
   formulas), fall back to a UNO/macro-driven open → `calculateAll()` →
   save, which is the more robust but more involved alternative.

`soffice` can be slow to start, hang waiting on a user profile lock, or
fail outright with "source file could not be loaded" in some sandboxed
environments — even for a trivial `.txt` input, unrelated to the document
being converted. If a call hangs, retry with a fresh
`-env:UserInstallation=file:///tmp/lo-<random>` profile directory rather
than killing and retrying against the same locked profile. If `soffice`
fails outright and a fresh profile doesn't help, treat visual rendering as
unavailable in that environment and fall back to structural verification
instead: for docx, unzip the file and confirm `word/styles.xml` defines the
expected style IDs and `word/document.xml` references them via
`w:pStyle`/`w:rStyle` (rather than raw `w:b`/`w:i`/`w:sz` formatting on
content that should be a style); for xlsx, inspect the formulas/styles
directly with `openpyxl` instead of recalculating visually.

## Rendering a PDF to an image or text with Poppler

```bash
pdftoppm -png -r 100 file.pdf preview      # → preview-1.png, preview-2.png, ...
pdftotext file.pdf -                        # plain text to stdout
pdfimages -list file.pdf -                  # list embedded images
```

Use `pdftoppm` to visually confirm a rendered docx/pptx/xlsx (converted to
PDF above) actually looks right — check page breaks, image placement, and
that styles rendered as expected — rather than trusting the generation code
ran without errors.

## Putting it together

A typical "did this come out right" check for a generated docx:

```bash
soffice --headless --convert-to pdf output.docx
pdftoppm -png -r 100 output.pdf preview
```

Then look at `preview-1.png` (etc.) before telling the user it's done.
