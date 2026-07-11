# Skills

This directory mirrors `.claude/skills/` for other AGENTS.md-aware tooling:
project-specific agent skills go here. It's currently empty on purpose:
MaHanya has no application code yet (see [`../../AGENTS.md`](../../AGENTS.md)
and [`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md)), so there's
nothing for a workflow skill to operate on.

Candidate skills once implementation starts, as ideas — none of these exist
yet:

- **run-sumo-scenario** — launch a calibrated SUMO scenario headlessly and
  summarize the resulting metrics.
- **train-model** — kick off transformer training with the project's standard
  hyperparameters.
- **docs-sync** — check that `docs/ARCHITECTURE.md`'s module list matches the
  actual `api/src` and `web/src` trees.

Add a skill here only once there's real code for it to act on.
