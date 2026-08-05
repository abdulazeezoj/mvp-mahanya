# Default docx Style Set (Quick Reference)

Copy-pasteable default. Use this unless the user has a brand kit or an
existing document whose styles should be matched instead.

```js
const { Document, HeadingLevel, AlignmentType } = require("docx");

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Calibri", size: 22 }, // 11pt body text
      },
    },
    paragraphStyles: [
      {
        id: "Title",
        name: "Title",
        basedOn: "Normal",
        next: "Normal",
        run: { font: "Calibri", size: 44, bold: true, color: "1F1F1F" },
        paragraph: { spacing: { after: 240 }, alignment: AlignmentType.CENTER },
      },
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: "Calibri", size: 32, bold: true, color: "1F1F1F" },
        paragraph: { spacing: { before: 360, after: 160 } },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: "Calibri", size: 26, bold: true, color: "2E2E2E" },
        paragraph: { spacing: { before: 280, after: 120 } },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: "Calibri", size: 22, bold: true, color: "2E2E2E" },
        paragraph: { spacing: { before: 200, after: 100 } },
      },
      {
        id: "Quote",
        name: "Quote",
        basedOn: "Normal",
        next: "Normal",
        run: { italics: true, color: "555555" },
        paragraph: {
          indent: { left: 480 },
          spacing: { before: 120, after: 120 },
        },
      },
      {
        id: "Caption",
        name: "Caption",
        basedOn: "Normal",
        next: "Normal",
        run: { size: 18, italics: true, color: "666666" },
        paragraph: { spacing: { before: 60, after: 240 }, alignment: AlignmentType.CENTER },
      },
    ],
    characterStyles: [
      {
        id: "Emphasis",
        name: "Emphasis",
        basedOn: "DefaultParagraphFont",
        run: { italics: true },
      },
      {
        id: "Strong",
        name: "Strong",
        basedOn: "DefaultParagraphFont",
        run: { bold: true },
      },
    ],
  },
  sections: [{ children: [] }],
});
```

Apply with `heading: HeadingLevel.HEADING_1` on a `Paragraph` for the
heading styles (docx maps `HeadingLevel` to the `HeadingN` style IDs
automatically), or `style: "Quote"` / `style: "Caption"` for the others.
For inline emphasis, reference the character style directly on a `TextRun`
(e.g. `style: "Emphasis"`) instead of setting `italics`/`bold` inline.

Adjust font, sizes, and colors to match a brand kit when one is provided —
keep the same style *names* and roles (Title/Heading1-3/Normal/Quote/
Caption/Emphasis/Strong) so the rest of the skill's guidance still applies.
