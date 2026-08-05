# docx Package Quick Reference

`npm install docx` (already declared in the root `package.json`; only
re-run install if `require("docx")` fails).

## Core constructs

| Construct | Use |
|-----------|-----|
| `Document({ styles, sections })` | Top-level document; `styles` per [style-set-template.md](./style-set-template.md) |
| `Paragraph({ heading, style, children })` | A paragraph; `heading: HeadingLevel.HEADING_1` for headings, `style: "Quote"`/`"Caption"` for others |
| `TextRun({ text, style, bold, italics })` | A run of text inside a paragraph; prefer `style: "Emphasis"`/`"Strong"` over raw `bold`/`italics` |
| `HeadingLevel` | `TITLE`, `HEADING_1`..`HEADING_6` |
| `Table({ rows })` / `TableRow({ children })` / `TableCell({ children })` | Tables |
| `ImageRun({ data, transformation: { width, height } })` | Embedded images — always set explicit `transformation` dimensions |
| `numbering` (on `Document`) + `Paragraph({ numbering: { reference, level } })` | Numbered/bulleted lists |
| `Packer.toBuffer(doc)` | Serialize to a `Buffer` for writing to disk |

## Writing to disk

```js
const { Packer } = require("docx");
const fs = require("fs");

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync("output.docx", buffer);
```

## Page setup

Set on a section: `sections: [{ properties: { page: { size, margin } }, children: [...] }]`.
