# AGENTS.md

MaHanya — priority-aware intelligent traffic control: SUMO simulation + a
lightweight Transformer Encoder + a deterministic rule-based safety
scheduler, calibrated against real traffic counts from the Sapon
Under-bridge Junction, Abeokuta. This is an Ahmadu Bello University
final-year project.

## Current phase: implementation

`api/` and `web/` are both scaffolded and implemented per
`docs/ARCHITECTURE.md`'s proposed source layout. Real commands to run, from
inside `api/`: `uv sync`, `uv run pytest`, `uv run ruff check`/`format`,
`uv run mypy src`, `uv run mahanya <fit|calibrate|generate|train|run|
evaluate|serve-api|build-web>`. From inside `web/`: `pnpm install`, `pnpm
dev`, `pnpm build`, `pnpm test` (vitest), `pnpm test:e2e` (Playwright),
`pnpm check`/`check:fix` (biome), `pnpm typecheck`.

SUMO must be installed (`apt-get install sumo sumo-tools`, or equivalent)
and `SUMO_HOME` set for anything that touches `mahanya.sumo` — the
calibrated network lives at `api/src/mahanya/sumo/network/`. The field-count
CSV at `api/data/raw/sapon_traffic_counts.csv` is a synthetic placeholder
(documented as such in-file) standing in until a real Sapon Junction survey
is collected; swapping it is a drop-in file replacement, no code changes.

## Read these first

- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) — what MaHanya must do,
  goals, non-goals, requirements.
- [`docs/PRODUCT_FLOW.md`](docs/PRODUCT_FLOW.md) — the end-to-end pipeline
  and runtime control loop.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — tech stack, component
  boundaries, data contracts, proposed source layout.
- [`docs/Project_Writing_Guideline.md`](docs/Project_Writing_Guideline.md) —
  formatting rules for the academic write-up
  (`docs/PROJECT_SUBMISSION_FINAL.docx`); not a code convention.

Before proposing or writing any implementation code, read the first three —
they contain the reasoning behind decisions that would otherwise look
arbitrary.

## What you'd otherwise get wrong

- **No prior code applies.** An earlier prototype (`aitrafix`) existed in
  this repo's git history and has been deleted entirely. Its useful ideas
  are captured in `docs/ARCHITECTURE.md`'s "Migration notes from aitrafix"
  section; everything else was intentionally discarded (e.g. it used a
  `RandomForestClassifier`, not a transformer).
- **Env managers are fixed by convention:** Python tooling uses `uv` (never
  pdm, poetry, or conda); the JS/TS toolchain uses `pnpm` (no volta).
- **The project is named MaHanya**, not "aitrafix" or "trafix" — don't
  reintroduce the old name in new files.

## Architecture at a glance

The single most important invariant, threaded through every doc: **the
transformer model's output is advisory only; the deterministic rule-based
scheduler is the sole authority over what signal state is actually
applied.** Every scheduler decision that overrides or holds the model's
recommendation is logged with a reason code (`model_accepted`,
`min_green_hold`, `anti_starvation_force`, `emergency_preempt`, ...) — see
[`docs/ARCHITECTURE.md#data-contracts`](docs/ARCHITECTURE.md#data-contracts).

The implementation splits into two independent, self-contained projects — see
[`docs/ARCHITECTURE.md#proposed-source-layout`](docs/ARCHITECTURE.md#proposed-source-layout):

- **`api/`** — Python: SUMO/TraCI simulation, the transformer model, the
  scheduler, and an internal FastAPI relay that exposes simulation state
  under `/api/*` (an internal process boundary, not a public API). Owns its
  own `pyproject.toml`.
- **`web/`** — a Next.js SPA static export, built exclusively from Shadcn UI
  components/variants and theme tokens, that renders the dashboard at `/*`
  and talks to the backend only through `/api/*` — never touching Python
  internals directly. Owns its own `package.json`.

Within `api/`, `mahanya` is the domain library (`schemas`, `data`, `sumo`,
`model`, `scheduler`, `evaluation`); `core`/`routes` are the FastAPI layer
built on top of it; `cli` is the Typer entrypoint exposing the whole
pipeline (fit, calibrate, generate, train, run, evaluate, serve-api,
build-web) as subcommands. `routes` depends on `core.deps` for shared
settings, never on `core.app` — `core.app` is what imports and includes
`routes`, so the reverse dependency would be a circular import.

## Conventions

- Diagrams in docs use Mermaid.
- Documentation lives under `docs/`; keep root guidance files (this one,
  `CLAUDE.md`) short and put detail there instead of growing them.
- `.claude/skills/` and `.agents/skills/` are currently placeholders — see
  their READMEs for why; add a skill only once there's real code for it to
  act on.
