# MaHanya

Priority-aware intelligent traffic control: SUMO simulation + a lightweight
Transformer Encoder + a deterministic rule-based safety scheduler, calibrated
against real traffic counts from the Sapon Under-bridge Junction, Abeokuta.

**Current phase: documentation & planning only.** There is no `api/`, `web/`,
`pyproject.toml`, `package.json`, or tests in this repo yet.

## Read these first

- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) — what MaHanya must do, goals,
  non-goals, requirements.
- [`docs/PRODUCT_FLOW.md`](docs/PRODUCT_FLOW.md) — the end-to-end pipeline and
  runtime control loop.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — tech stack, component
  boundaries, data contracts, proposed source layout.

Before proposing or writing any implementation code, read all three — they
contain the reasoning behind decisions that would otherwise look arbitrary.

## What you'd otherwise get wrong

- **No prior code applies.** An earlier prototype (`aitrafix`) existed in this
  repo's git history and has been deleted entirely. Don't assume its
  dependencies, structure, or approach still apply — its useful ideas are
  captured in `docs/ARCHITECTURE.md`'s "Migration notes from aitrafix" section;
  everything else was intentionally discarded (see that section for specifics,
  e.g. it used a `RandomForestClassifier`, not a transformer).
- **Env managers are fixed by convention, not per-project preference:** Python
  tooling uses `uv` (never pdm, poetry, or conda). A JS/TS toolchain, if one is
  ever introduced, uses `volta`. There is no JS/TS in this project today.
- **The project is named MaHanya**, not "aitrafix" or "trafix" — don't
  reintroduce the old name in new files.
- **This phase is docs-only.** Don't scaffold `api/`, `web/`, `pyproject.toml`,
  `package.json`, or any application code unless explicitly asked to begin the
  implementation phase.

## Conventions

- Diagrams in docs use Mermaid.
- Documentation lives under `docs/`; keep this file short and put detail there
  instead of growing it.
- `.claude/skills/` is currently a placeholder — see its README for why.
