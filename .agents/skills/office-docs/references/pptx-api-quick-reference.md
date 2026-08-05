# pptxgenjs Package Quick Reference

`npm install pptxgenjs` (already declared in the root `package.json`; only
re-run install if `require("pptxgenjs")` fails).

## Core constructs

| Construct | Use |
|-----------|-----|
| `new pptxgenjs()` | Create a presentation |
| `pptx.defineSlideMaster({ title, background, objects })` | Define a reusable master/theme — do this before adding slides |
| `pptx.addSlide({ masterName })` | Add a slide using a defined master |
| `slide.addText(text, options)` | Text box; pull font/size/color from the master's theme rather than hardcoding per call |
| `slide.addImage({ path, x, y, w, h })` | Image, positioned against the layout grid |
| `slide.addChart(type, data, options)` | Native chart (bar/line/pie/etc.) |
| `slide.addTable(rows, options)` | Table |
| `slide.addNotes(text)` | Speaker notes |
| `pptx.writeFile({ fileName })` | Write the `.pptx` to disk |

## Layout basics

Positions/sizes are in inches by default (`x`, `y`, `w`, `h`). Set
`pptx.defineLayout({ name, width, height })` and `pptx.layout = name` if
the default 10x5.63" widescreen layout isn't what's wanted.

## Icon rendering (optional)

Only needed if a slide requires custom-rendered icons rather than
`addImage`-ed static assets: `npm install react-icons react react-dom
sharp` (not installed by default — add only if this comes up).
