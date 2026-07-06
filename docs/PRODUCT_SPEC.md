# MaHanya — Product Spec

## Purpose & audience

This document defines *what* MaHanya must do and *why*, independent of how it's
built. It's written for three audiences: academic evaluators of the underlying
final-year project, future maintainers who need to know what's in and out of
scope, and anyone deciding whether a proposed change belongs in this system at
all. For *how* it's built, see [Architecture](ARCHITECTURE.md). For the
end-to-end operational flow, see [Product Flow](PRODUCT_FLOW.md).

## Problem statement

Fixed-time traffic signal systems allocate green time on a predetermined schedule,
regardless of real-time demand. At multi-direction road junctions — including
those in growing Nigerian cities such as Zaria, Kaduna, and Abuja — this produces:

- Unnecessary vehicle delay on heavily loaded approaches while green time is
  wasted on lightly loaded ones.
- No systematic mechanism for prioritizing emergency vehicles.
- Accumulating queue imbalances during peak periods.

Changing physical infrastructure to address this is expensive and impractical for
an academic project. A simulation-based approach — calibrated with real traffic
data and combined with a rule-guided scheduler — offers a rigorous, reproducible
way to study intelligent signal control within a final-year project's scope.

## Goals

- Calibrate a microscopic traffic simulation of a real junction using real
  vehicle-arrival data.
- Recommend signal phases from observed traffic conditions using a trained model.
- Guarantee every applied signal decision satisfies deterministic safety rules,
  regardless of what the model recommends.
- Give emergency vehicles a systematic priority path through the junction.
- Demonstrate measurable improvement over a fixed-time baseline on standard
  traffic-engineering metrics.
- Make every decision the system makes visible and auditable in real time.

## Non-goals

- **No physical hardware integration.** MaHanya controls a SUMO simulation, not a
  real traffic signal controller or physical sensors.
- **No multi-junction, network-wide optimization.** Scope is a single junction
  (the Sapon Under-bridge Junction, Abeokuta, as the calibration case study).
- **No production or city-wide deployment.** This is a simulation-based academic
  prototype, evaluated against a fixed-time baseline on simulated scenarios — not
  a system intended to go live on a real road.
- **No general-purpose traffic-engineering platform.** Features are scoped to what
  the stated objectives require, not extended for hypothetical future junctions
  or use cases.

## Stakeholders

- **Academic evaluators** — need to see the stated objectives met, with
  reproducible evidence (data, calibration, trained model, evaluation results).
- **A hypothetical traffic authority** — the intended real-world beneficiary of
  this class of system, useful as a lens for realism (e.g. "would a traffic
  engineer trust this scheduler's behavior?").
- **Driver/pedestrian safety reviewers** — the emergency-preemption and rule-based
  scheduler behavior must be defensible on safety grounds, not just performance.

## Functional requirements

Each of the following maps directly to a synopsis objective.

### 1. Traffic count data collection
The system must ingest vehicle-arrival counts collected at the Sapon Under-bridge
Junction across all junction directions, separately for peak and off-peak
periods.

### 2. Statistical calibration
The system must fit collected arrival data to an appropriate statistical
distribution and use the derived parameters to calibrate a multi-phase SUMO
microscopic simulation of the junction.

### 3. Sequence generation and phase-recommendation model
The system must generate labelled time-series traffic-state sequences from the
calibrated simulation and train a lightweight Transformer Encoder model that
recommends a signal phase from a window of observed traffic state.

### 4. Rule-based priority scheduler
The system must validate every model recommendation against deterministic
operational rules before applying it, specifically:
- **Minimum green time** — a phase cannot end before its minimum duration elapses.
- **Maximum green time** — a phase cannot run indefinitely even under sustained
  demand.
- **Transition intervals** — yellow and all-red clearance intervals are enforced
  between any two conflicting phases.
- **Anti-starvation** — a direction that has waited longer than a defined
  threshold forces a phase change, regardless of the model's recommendation.
- **Emergency vehicle pre-emption** — a detected emergency vehicle immediately
  and safely overrides normal control to grant it right of way, then returns to
  normal control.

### 5. Real-time dashboard
The system must provide a dashboard visualizing, at minimum: current junction
state (per-direction vehicle counts, queue, emergency presence), the active
signal phase, priority/pre-emption events as they occur, and the model's
recommendation alongside the scheduler's actual decision.

### 6. Evaluation against a fixed-time baseline
The system must evaluate the intelligent controller against a fixed-time
baseline on identical simulation scenarios, reporting at minimum: average
waiting time, queue length, throughput, and priority-vehicle response time.

## Non-functional requirements

- **Reproducibility.** Simulation runs must be seedable and re-runnable to
  produce comparable results across the intelligent controller and the
  baseline.
- **Auditability.** Every scheduler decision that overrides or modifies the
  model's recommendation must be logged with an explicit reason (e.g. minimum
  green time held, anti-starvation forced, emergency pre-emption engaged).
- **Safety framing.** The rule-based scheduler is the sole authority over what
  signal state is actually applied. The model's output is advisory input only —
  it is never applied directly.

## Success / acceptance criteria

Concrete numeric thresholds are **TBD** — they depend on real traffic-count data
and baseline simulation results that don't exist yet. Once a fixed-time baseline
has been run on the calibrated simulation, this section should be updated with
specific targets, e.g. "average waiting time reduced by at least X% versus the
fixed-time baseline on the same scenario set." Until then, the qualitative bar is:

- The intelligent controller measurably outperforms the fixed-time baseline on
  at least average waiting time and priority-vehicle response time, on the same
  simulated scenarios.
- The scheduler never applies a signal state that violates a hard safety
  constraint (minimum green, transition interval, or conflicting simultaneous
  greens) across the full evaluation run.

## Assumptions & constraints

- Single junction, four-way (Sapon Under-bridge Junction, Abeokuta), simulated
  only — no physical deployment.
- Calibration relies on manually or field-collected vehicle counts, not
  continuous sensor feeds.
- Emergency-vehicle detection is provided by the simulation environment (SUMO
  vehicle class), not by a real-world sensing pipeline.

## Glossary

| Term | Meaning |
|---|---|
| Phase | A specific combination of signal indications (which approaches are green/yellow/red) at a point in time. |
| Green / yellow / all-red | Standard signal indications; all-red is a clearance interval where every approach is red. |
| Headway | The time gap between successive vehicle arrivals. |
| Pre-emption | Overriding normal signal control to grant immediate right of way to a priority vehicle. |
| Anti-starvation | A rule that forces a phase change if a direction has waited too long, preventing indefinite denial of service. |
| Occupancy | The proportion of time a detector/lane is occupied by a vehicle. |
| Throughput | The number of vehicles that clear the junction per unit time. |
