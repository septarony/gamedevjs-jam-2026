# Lembang Heritage: The Steam Machine

## Project Overview

Lembang Heritage: The Steam Machine is a web-based simulation game built for the Gamedev.js Jam 2026 theme, MACHINES. The player operates a colonial-era tea factory steam system and must keep the machinery stable while maximizing tea processing output.

The project is implemented with React and Vite, with game state managed through lightweight React Hooks for efficient updates on low-resource devices.

## Why This Project Stands Out

- Clear machine fantasy: every action is tied to boiler pressure, heat, and mechanical stability.
- Score with tension: tea production grows only when the machine remains healthy.
- Educational layer: historical facts unlock as performance milestones are reached.
- Jam-friendly architecture: compact codebase, fast build, and readable gameplay logic.

## Core Mechanics

The gameplay is driven by a small set of coupled system variables:

- `steamPressure`: Represents boiler pressure. If this reaches 100, the machine explodes and the run ends.
- `machineHeat`: Represents thermal load inside the mechanical system. Rising heat contributes to instability.
- `stability`: Represents overall machine condition and operational control.
- `processedTeaKg` (`teaProcessed`): Represents total tea output in kilograms and acts as the score/progression metric.
- `survivalTimeSec`: Measures how long the player keeps the machine operational.

These variables interact continuously, so player actions have trade-offs rather than isolated effects.

### Mechanical Relationship Summary

- Pressure rises continuously and is reduced by active intervention.
- Heat rises as pressure remains high.
- Stability declines under dangerous pressure and heat conditions.
- Tea output depends on stability, so poor machine health directly lowers productivity.
- Defeat condition is deterministic: `steamPressure >= 100`.

## Controls

The control panel exposes three core actions:

- `Release Steam`: Drops steam pressure quickly, but slightly reduces stability.
- `Oil Gears` (implemented as `Lubricate Gears` in UI): Reduces machine heat and improves stability.
- `Refill Water` (implemented as `Refill Boiler` in UI): Improves stability and lowers both pressure and heat moderately.

Together, these controls form a balancing loop where aggressive pressure management must be synchronized with thermal and stability recovery.

### Control Design Intent

- No single best button: each action solves a problem while creating a new risk.
- Fast tactical play: players must react to rising pressure while planning around heat and stability.
- Readable outcomes: each control has immediate, visible impact on dashboard values.

## Game Loop

The game runs on a timed loop (`useEffect` + `setInterval`) that updates once per second.

At each tick:

1. Pressure increases based on base gain and current stability.
2. Heat increases based on base gain and current pressure.
3. Stability degrades, with harsher penalties at high pressure/heat thresholds.
4. Tea production is calculated from current stability.

Difficulty naturally escalates over time because pressure and heat compound while stability decays, forcing the player to make faster and more precise control decisions to avoid Game Over.

## Historical Integration

The game includes a `Heritage Facts` feature containing curated historical notes about Lembang's colonial tea industry.

- A new heritage fact is unlocked every 50 kg of processed tea.
- This system ties gameplay performance directly to educational progression, combining challenge and historical context in a single loop.

## Technical Implementation

### State Model

The game uses a single state object updated through functional React state updates to keep logic predictable and minimize overhead:

- `steamPressure`
- `machineHeat`
- `stability`
- `processedTeaKg`
- `survivalTimeSec`
- `factIndex`
- `isGameOver`

### Performance Notes

- Lightweight 1-second tick loop to reduce render pressure on low-end devices.
- Functional `setState` updates to avoid stale state bugs.
- Derived UI values memoized where appropriate.
- Minimal dependency footprint: React + Vite only.

## Design Rationale

- Theme alignment: the system models a machine under stress rather than abstract points.
- Player readability: six core indicators keep decision-making clear.
- Educational pacing: heritage facts are milestone rewards, not passive text walls.
- Replayability: deterministic mechanics with compounding pressure create different outcomes per run.

## Getting Started

### Requirements

- Node.js 18+
- npm 9+

### Run Locally

```bash
npm install
npm run dev
```

### Production Build

```bash
npm run build
npm run preview
```

## Available Scripts

- `npm run dev`: Starts local development server.
- `npm run build`: Creates production build in `dist`.
- `npm run preview`: Serves production build locally.

## Jam Submission Snapshot

- Title: Lembang Heritage: The Steam Machine
- Event: Gamedev.js Jam 2026
- Theme: MACHINES
- Genre: Mechanical survival simulation
- Platform: Web (desktop and mobile browsers)

## Future Expansion (Post-Jam)

- Progressive hazard phases by survival time.
- Audio feedback for pressure, heat, and overload thresholds.
- Additional machine modules (valves, turbines, conveyor gates).
- More localized archival facts and multilingual presentation.