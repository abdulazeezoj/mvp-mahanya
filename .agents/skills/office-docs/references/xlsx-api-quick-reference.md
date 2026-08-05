# openpyxl / pandas Quick Reference

Already declared in the root `pyproject.toml`.

## openpyxl core constructs

| Construct | Use |
|-----------|-----|
| `openpyxl.Workbook()` | New workbook |
| `wb.active` / `wb.create_sheet(title)` | Get/add a worksheet |
| `ws["A1"] = value` / `ws.cell(row, column, value)` | Set a cell value |
| `ws["A1"] = "=SUM(B1:B10)"` | A formula (written as text; see recalculation note below) |
| `openpyxl.styles.NamedStyle(name=...)` | A reusable named style — define once, assign via `cell.style = "header"` |
| `openpyxl.styles.Font/PatternFill/Alignment/numbers` | Style building blocks used inside a `NamedStyle` |
| `ws.freeze_panes = "A2"` | Freeze the header row |
| `ws.column_dimensions["A"].width = 20` | Explicit column width |
| `openpyxl.chart.BarChart/LineChart/PieChart` + `ws.add_chart(chart, "E2")` | Native charts |
| `wb.save(path)` | Write to disk |

## pandas for bulk data

```python
import pandas as pd

df.to_excel("output.xlsx", sheet_name="Data", index=False)
# or, to combine with openpyxl formatting on the same file:
with pd.ExcelWriter("output.xlsx", engine="openpyxl") as writer:
    df.to_excel(writer, sheet_name="Data", index=False)
    # then continue formatting via writer.book / writer.sheets["Data"]
```

## Recalculating formulas

`openpyxl` never evaluates formulas — see
[../guides/inspect-convert-and-render.md](../guides/inspect-convert-and-render.md)
for the LibreOffice headless recalculation step.
