# Final Check (Quick Reference)

Before delivering a generated or edited document, verify:

1. **Styles/theme defined and used consistently** — docx headings use
   `HeadingLevel`/named styles (not ad-hoc bold text), pptx slides use the
   defined master/theme, xlsx uses named styles for recurring cell types —
   not one-off inline formatting scattered through the file.
2. **Formulas recalculated** (xlsx) — computed values show up when opened,
   not blank/zero cells.
3. **Output validated/rendered** — actually ran the LibreOffice/Poppler
   render step (see
   [../guides/inspect-convert-and-render.md](../guides/inspect-convert-and-render.md))
   and looked at the result, rather than assuming the generation code
   worked because it didn't throw.
4. **No leftover placeholder text** — no `TODO`, `Lorem ipsum`, `[insert
   X here]`, or template scaffolding left in the delivered file.
5. **Content matches the request** — re-read the generated file with
   `markitdown` and confirm it actually says what was asked for, in the
   right structure (right headings, right table columns, right slide
   count).
