# Create a Slide Deck (pptx)

Uses the `pptxgenjs` npm package.

## Define a slide master/theme first

Before adding slides, define a slide master (or at minimum a consistent set
of theme values — font family, heading/body font sizes, color palette,
logo/footer placement) and reuse it across every slide via
`pptx.defineSlideMaster(...)` and `pptx.addSlide({ masterName })`. Don't
style each slide's text boxes with one-off font/color/size values — define
the look once so the deck is easy to restyle and stays visually consistent
slide to slide.

## Structuring a deck

- **Title slide** — deck title, subtitle/context, uses the master's title
  styling.
- **Section/content slides** — pick the simplest layout that fits the
  content (title + bullets, title + image, two-column, comparison) rather
  than cramming everything onto one dense slide.
- **Text** — `addText` with the master's defined text styles; avoid manual
  per-run font tweaks.
- **Images/charts** — `addImage`/`addChart`, sized and positioned
  deliberately against the slide's layout grid, not dropped at arbitrary
  coordinates.
- **Speaker notes** — `addNotes` when the deck is meant to be presented
  live rather than read standalone.

See [references/pptx-api-quick-reference.md](../references/pptx-api-quick-reference.md)
for the concrete API constructs.

## Before finishing

Render and validate the output — see
[inspect-convert-and-render.md](./inspect-convert-and-render.md) — and run
through [references/final-check.md](../references/final-check.md).
