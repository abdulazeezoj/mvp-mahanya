# reportlab / pypdf / pdfplumber Quick Reference

Already declared in the root `pyproject.toml`.

## reportlab (generate from scratch)

| Construct | Use |
|-----------|-----|
| `reportlab.platypus.SimpleDocTemplate(path, pagesize=...)` | Flowable-based document builder — prefer this over raw `Canvas` |
| `reportlab.lib.styles.ParagraphStyle(name, ...)` | A named style (Title/Heading/Body) — define once, reuse via `getSampleStyleSheet()` as a base |
| `reportlab.platypus.Paragraph(text, style)` | A styled paragraph flowable |
| `reportlab.platypus.Table(data)` + `TableStyle` | Tables |
| `reportlab.platypus.Spacer(width, height)` | Vertical spacing between flowables |
| `doc.build(story)` | Render the flowable list (`story`) to the PDF |
| `reportlab.pdfgen.canvas.Canvas(path)` | Low-level absolute positioning — only for precise overlay work (e.g. pre-printed forms) |

## pypdf (manipulate existing PDFs)

| Construct | Use |
|-----------|-----|
| `pypdf.PdfReader(path)` | Read an existing PDF |
| `pypdf.PdfWriter()` | Build a new PDF from pages/content |
| `writer.append(reader)` / `writer.merge_page(...)` | Merge |
| `reader.pages[i]` + `writer.add_page(page)` | Split/reorder |
| `writer.add_metadata({...})` | Set document metadata |
| `reader.get_fields()` / `writer.update_page_form_field_values(...)` | Read/fill AcroForm fields |

## pdfplumber (extract content)

| Construct | Use |
|-----------|-----|
| `pdfplumber.open(path)` | Open for extraction |
| `page.extract_text()` | Plain text from a page |
| `page.extract_tables()` | Tables as lists of rows |
| `page.chars` / `page.rects` | Low-level layout data, for precise positional extraction |
