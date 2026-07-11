# MaHanya

Priority-aware intelligent traffic control, simulated on real junction data.

> **Status: documentation & planning phase.** There is no application code in this
> repository yet — see [Repo Layout](#repo-layout) below. This phase exists to nail
> down the product spec, the end-to-end flow, and the technical architecture before
> any implementation begins.

## Background

Most road junctions in growing Nigerian cities — Zaria, Kaduna, Abuja among them —
run on fixed-time traffic signal plans: green time is allocated on a predetermined
schedule regardless of actual demand. This wastes green time on light directions,
adds avoidable delay on heavy ones, and gives emergency vehicles no way to get
priority through the junction.

MaHanya is a simulation-based alternative: calibrate a microscopic traffic
simulation with real vehicle-arrival data, train a lightweight model to recommend
signal phases from observed traffic state, and wrap every recommendation in a
deterministic, safety-critical rule layer before it's ever applied. The goal is a
system that measurably beats a fixed-time baseline — in waiting time, queue length,
throughput, and emergency-vehicle response time — without ever trusting a model
output directly for a safety-relevant decision.

This is the basis for an Ahmadu Bello University final-year project, calibrated
against real traffic counts collected at the **Sapon Under-bridge Junction,
Abeokuta**.

## What it does

1. Fits real traffic-count data (peak and off-peak) to a statistical arrival
   distribution.
2. Uses that distribution to calibrate a SUMO microscopic simulation of the
   junction.
3. Trains a lightweight Transformer Encoder on simulated traffic-state sequences
   to recommend signal phases.
4. Validates every recommendation against a rule-based scheduler — minimum/maximum
   green time, transition intervals, anti-starvation, and emergency-vehicle
   pre-emption — before applying it.
5. Evaluates the result against a fixed-time baseline on the same scenarios.
6. Visualizes junction state, signal phase, priority events, and model
   recommendations on a dashboard.

Read the full details in the docs:

- **[Product Spec](docs/PRODUCT_SPEC.md)** — problem, goals, requirements,
  non-goals, success criteria.
- **[Product Flow](docs/PRODUCT_FLOW.md)** — the end-to-end pipeline, from field
  data to dashboard, including the runtime control loop.
- **[Architecture](docs/ARCHITECTURE.md)** — the technical design, tech-stack
  choices and justification, data contracts, and module boundaries.
- **[Project Synopsis](docs/PROJECT_SYNOPSIS.docx)** — the original university
  project synopsis this repo is based on.
- **[Project Writing Guidelines](docs/Project_Writing_Guideline.md)** —
  formatting rules for the final project write-up (`Project_Submission.docx`),
  not for code.

## Tech stack

Python + web: SUMO + TraCI for simulation, PyTorch for the transformer encoder,
`scipy.stats` for distribution fitting, FastAPI for the internal `/api/*` simulation relay,
Typer for the CLI, and a Next.js SPA static export with Shadcn UI for the
`/*` dashboard. See [Architecture](docs/ARCHITECTURE.md#tech-stack) for the full
reasoning. Dependency and environment management uses [`uv`](https://docs.astral.sh/uv/)
for the `api/` Python toolchain and [`volta`](https://volta.sh/) for the
`web/` JS/TS toolchain.

## Repo layout

```
mvp-mahanya/
├── README.md
├── CLAUDE.md
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── PRODUCT_FLOW.md
│   └── ARCHITECTURE.md
└── .claude/
    ├── settings.json
    └── skills/
        └── README.md
```

No `api/`, `web/`, `pyproject.toml`, `package.json`, or tests exist yet — those
are introduced in the implementation phase, once the docs above are settled.
The proposed future layout splits into two independent, self-contained
projects, documented in
[Architecture](docs/ARCHITECTURE.md#proposed-source-layout): `api/` (own
`pyproject.toml`, with `mahanya`, `core`, `routes`, and `cli` under
`api/src`) for the simulation/model/scheduler internals, the internal FastAPI
relay, and the Typer CLI; and `web/` (own `package.json`, Next.js source
under `web/src`) for the SPA dashboard.

## How to run it

Not yet — this phase is docs only. Once implementation starts, setup and run
instructions will live here and in `docs/ARCHITECTURE.md`.

## Prior art

An earlier rough prototype (`aitrafix`) explored the same problem space with a
`RandomForestClassifier` standing in for the transformer and no rule-based
scheduler. It's been retired in favor of this more rigorous plan; the ideas worth
keeping from it are called out in [Architecture](docs/ARCHITECTURE.md#migration-notes-from-aitrafix).

## License

MIT. Author: Abdulazeez Jimoh.
