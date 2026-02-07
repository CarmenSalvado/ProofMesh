# ProofMesh: The Story Behind the Build

## How it started

Mathematical collaboration still feels fragmented: writing in one place, formal verification in another, and discussion scattered across chats and documents.

ProofMesh started from a simple thesis: proofs are not just linear text. They are networks of definitions, claims, checks, revisions, and references that evolve over time.

That is why this repository combines a writing lab, a visual canvas, a knowledge library, and AI-assisted formalization inside one workflow.

## What we learned

**Formal verification is binary.** Lean 4 enforces exactness. Something can look mathematically reasonable and still fail to type-check. That gap between informal reasoning and formal code is exactly where assisted formalization helps most.

**Specialized agent roles work better than a single generic assistant.** In the current runtime, responsibilities are split into explorer, formalizer, critic, and latex assistant roles.

**The orchestrator should stay deterministic.** In this codebase, orchestration is explicit Python control flow (`mesh/backend/orchestrator.py`), while model calls are delegated to the runtime and verification is delegated to the Lean runner.

## How we built it

ProofMesh runs as a multi-service local stack in Docker Compose:

- `frontend` (Next.js 16, TypeScript, Tailwind CSS 4)
- `backend` (FastAPI, SQLAlchemy async)
- `postgres`
- `redis`
- `minio`
- `lean-runner`
- `texlive-compiler`
- `canvas-ai-worker`

**The canvas.** The proof canvas is implemented as a large pan-and-zoom workspace for nodes and edges. It is designed for visual dependency mapping and iterative refinement, not just linear editing.

**Rho, the AI layer.** Rho is the product AI persona and orchestration layer. In practice, the system is wired to Gemini models with both fast and reasoning-oriented paths (for example flash vs thinking/pro in different routes and flows), plus streaming support and retry logic in the base agent layer.

| Mode | Behavior | Use case |
|------|----------|----------|
| Flash / Fast | Lower-latency generation | Drafting, quick edits |
| Thinking / Reasoning | More deliberate reasoning path | Critique, formalization, deeper assistance |

**The Lean runner.** Lean verification is isolated in `lean-runner` and exposed through HTTP (`POST /verify`). The service writes a temporary `.lean` file, runs `lake env lean`, returns structured output, and removes the temp file. Lean dependencies are cached via mounted `.lake` volume.

**Async real-time pipeline.** Canvas AI runs are persisted and queued in Redis, processed by `canvas-ai-worker`, and streamed back through Redis Pub/Sub + WebSocket endpoints (`/api/canvas-ai/problems/{problem_id}/ws` and `/api/canvas-ai/runs/{run_id}/stream`).

**The knowledge library.** Mathematical artifacts are stored as typed library items (`LEMMA`, `THEOREM`, `DEFINITION`, `CLAIM`, plus additional kinds like `FORMAL_TEST`, `COUNTEREXAMPLE`, `COMPUTATION`, `NOTE`, `IDEA`, `RESOURCE`, `CONTENT`) with status, dependencies, and optional Lean/code metadata.

## What gave us trouble

**Lean and Mathlib reliability under real workloads.** Toolchain compatibility and dependency state matter. The repo now pins Lean via `mesh/mesh_project/lean-toolchain` and includes cache/repair logic in the runner path.

**Model outputs that look right but fail verification.** Generated formal code can be plausible and still not compile. That is why verification and critique are explicit steps, not optional polish.

**Keeping collaboration responsive while jobs run in background.** Long-running AI/formalization paths required queue-based execution, state tracking, and event streaming rather than synchronous request/response UX.

**Editor and math UX integration.** The frontend had to make Monaco, KaTeX, PDF.js, mentions, and AI workflows coexist in one coherent workspace.

**Operational complexity.** Coordinating eight services locally (plus env wiring, storage, and background workers) made `docker-compose.yml` and `Makefile` central to day-to-day development.

## What's next

Near-term priorities are consistent with the current architecture:

- stronger semantic retrieval across library/canvas/discussion context,
- tighter Lean + library interoperability,
- better end-to-end evaluation and test coverage for AI-assisted flows.

---

ProofMesh is built around one practical idea: collaborative mathematical work should be easier to share, inspect, and verify, without losing rigor.
