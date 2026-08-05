# Create a Word Document (docx)

Uses the `docx` npm package.

## Always define a style set first

Before adding any content, define the document's style set via the
`styles` option on `Document`. Never format headings or body text with
one-off inline `bold`/`size`/`color` runs — apply a named style instead.
This is what keeps the document consistent and lets a human re-style the
whole thing later by editing one style definition, exactly like they would
in Word's own Styles pane.

At minimum, define:

- `Title`
- `Heading1`, `Heading2`, `Heading3`
- `Normal` (body text)
- `Quote` (paragraph style, if the document has any blockquotes/callouts)
- `Emphasis` and `Strong` (character styles for italic/bold inline text —
  define these instead of applying raw `italics: true`/`bold: true` runs
  throughout the body, same reasoning as the paragraph styles)
- `Caption` (if the document has any figures/tables needing captions)

See [references/style-set-template.md](../references/style-set-template.md)
for a copy-pasteable default set — use it unless the user has given a
brand/template to follow instead. If they have a brand kit or an existing
document to match, derive the style set from that instead of the default.

## Structuring content against the style set

Once styles are defined, every paragraph should reference a style by name
(`heading: HeadingLevel.HEADING_1` or `style: "Quote"`) rather than setting
ad-hoc formatting. Structure:

- **Headings** — use `HeadingLevel.HEADING_1/2/3`, never a bold, larger
  `Normal` paragraph pretending to be a heading.
- **Body paragraphs** — plain `Paragraph` with `TextRun` children, relying
  on the `Normal` style for font/size/spacing.
- **Tables** — `Table`/`TableRow`/`TableCell`, with header rows styled
  distinctly (bold or shaded) and body rows consistent.
- **Lists** — numbered or bulleted via `numbering` references, not manually
  typed "1." / "-" prefixes.
- **Images** — `ImageRun`, sized deliberately (don't leave a default huge
  image), with a `Caption`-styled paragraph underneath if it needs one.
- **Page setup** — set margins/orientation/page size explicitly if the
  target isn't a standard US Letter/A4 portrait document.

See [references/docx-api-quick-reference.md](../references/docx-api-quick-reference.md)
for the concrete API constructs.

## Before finishing

Render and validate the output — see
[inspect-convert-and-render.md](./inspect-convert-and-render.md) — and run
through [references/final-check.md](../references/final-check.md).
