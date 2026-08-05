# Create a Spreadsheet (xlsx)

Uses the Python `openpyxl` and `pandas` packages.

## Choosing the right tool

- **`pandas` (`DataFrame.to_excel`)** — bulk tabular data in/out: dumping a
  dataset to a sheet, or reading one back for analysis. Fast, but limited
  control over formatting/formulas.
- **`openpyxl`** — anything needing cell-level control: formulas, number
  formats, conditional formatting, merged cells, charts, multiple
  styled sheets. Use `pandas` to get data in, then `openpyxl` (or
  `pandas.ExcelWriter(engine="openpyxl")`) to format it.

## Structure and consistency

- Define **named styles** (`openpyxl.styles.NamedStyle`) for headers, totals,
  and any recurring cell types (currency, percentage, date) instead of
  applying ad-hoc `Font`/`Fill`/`number_format` to individual cells — same
  reasoning as docx styles: define once, apply everywhere, easy to restyle.
- Freeze header rows (`ws.freeze_panes`) on any sheet with more than a
  screen's worth of rows.
- Use real formulas (`=SUM(...)`, `=VLOOKUP(...)`, etc.) for computed
  values rather than hardcoding a value Python already calculated — a
  spreadsheet's whole point is that the user can change an input and see
  results update.
- Set explicit column widths for anything wider than the default; don't
  ship a sheet where the data is cut off or invisible.

## Recalculating formulas

`openpyxl` writes formulas as text — it does not evaluate them. After
writing formulas, recalculate via LibreOffice headless (see
[inspect-convert-and-render.md](./inspect-convert-and-render.md)) so the
delivered file shows computed values, not `0` or blank cells, when opened
in a viewer that doesn't auto-recalculate.

See [references/xlsx-api-quick-reference.md](../references/xlsx-api-quick-reference.md)
for the concrete API constructs.

## Before finishing

Recalculate, then validate — see
[inspect-convert-and-render.md](./inspect-convert-and-render.md) — and run
through [references/final-check.md](../references/final-check.md).
