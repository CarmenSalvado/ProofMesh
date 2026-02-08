## Inspiration

Mathematical collaboration still feels fragmented. Writing happens in one place, formal verification in another, and discussion gets scattered across chats and documents. ProofMesh started from a simple thesis: proofs are not just linear text. They are networks of definitions, claims, checks, revisions, and references that evolve over time.

We wanted something closer to how teams actually work. A mathematician in Buenos Aires sketches a claim, someone in Tokyo tries to break it, and the proof still needs to compile in Lean 4. The workflow should support the whole loop in one shared space.

$
\text{Idea} \rightarrow \text{Draft} \rightarrow \text{Argument} \rightarrow \text{Lean} \rightarrow \text{Fix} \rightarrow \text{Verified}
$

## What it does

ProofMesh is a single workflow for collaborative proof work that spans informal drafting, structured discussion, and formal verification.

It combines a writing lab, a visual proof canvas, a typed knowledge library, and AI-assisted formalization. The canvas represents proofs as a dependency graph, not a linear document. The library stores artifacts as reusable items with explicit types, status, and dependencies. Rho provides role-based assistance for exploration, formalization, critique, and LaTeX help, while verification stays explicit and first class.

A compact way to say it:

$
\text{ProofMesh} \approx \text{Docs} + \text{Graph} + \text{Verification} + \text{Collaboration}
$

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

The canvas is a large pan and zoom workspace for nodes and edges. It is designed for visual dependency mapping and iterative refinement, not just linear editing.

Rho is the AI layer, and ProofMesh integrates **Gemini 3** across the stack through two paths. The backend agent system uses the `google-genai` Python SDK, and the frontend LaTeX editing flow uses the `@ai-sdk/google` Vercel SDK. Agents run on a two-tier strategy: **Gemini 3 Flash** for fast, high-throughput tasks like exploration, LaTeX assistance, idea fusion, and pattern scoring, and **Gemini 3 Pro** for reasoning-heavy work like formalizing math into Lean 4, critiquing proof proposals, and multi-step canvas workflows. Each agent sets task-specific temperatures, for example `0.0` for deterministic scoring and `0.9` for creative ideation, plus explicit token budgets.

Three Gemini capabilities are load-bearing for the product. **Streaming** lets canvas agents push partial output to the UI in real time. **Extended thinking** using `gemini-3-flash-preview-thinking` powers deeper LaTeX edit reasoning inside the editor flow. **Tool use** lets the LaTeX chat agent call a structured `updateDocument` function so it can apply precise edits instead of regenerating entire documents.

Semantic retrieval uses **`text-embedding-004`** for search across the knowledge graph, matching mathematical concepts by meaning and supporting retrieval-augmented proof construction. Agents also disable safety filtering to allow unrestricted mathematical content.

Lean verification is isolated in `lean-runner` and exposed through HTTP (`POST /verify`). The service writes a temporary `.lean` file, runs `lake env lean`, returns structured output, and removes the temp file. Lean dependencies are cached via a mounted `.lake` volume.

Canvas AI runs are persisted and queued in Redis, processed by `canvas-ai-worker`, and streamed back through Redis Pub/Sub plus WebSocket endpoints like `/api/canvas-ai/problems/{problem_id}/ws` and `/api/canvas-ai/runs/{run_id}/stream`.

Mathematical artifacts are stored as typed library items (`LEMMA`, `THEOREM`, `DEFINITION`, `CLAIM`, plus additional kinds like `FORMAL_TEST`, `COUNTEREXAMPLE`, `COMPUTATION`, `NOTE`, `IDEA`, `RESOURCE`, `CONTENT`) with status, dependencies, and optional Lean or code metadata.

ProofMesh also ships a social layer in the core backend and frontend flow. This includes an activity feed, discussions and comments, teams, follows, stars, notifications, trending views, and `@rho` mention handling so AI collaboration can happen inside threads, not only in isolated assistant panels.

## Challenges we ran into

Lean and Mathlib reliability under real workloads was a recurring pain point. Toolchain compatibility and dependency state matter, so the repo pins Lean via `mesh/mesh_project/lean-toolchain` and includes cache and repair logic in the runner path.

Model outputs can look right and still fail verification. Generated formal code is often plausible but does not compile. That is why verification and critique are explicit steps, not optional polish.

$
P(\text{compiles} \mid \text{looks right}) \ll 1
$

Keeping collaboration responsive while jobs run in the background required queue-based execution, state tracking, and event streaming rather than synchronous request and response UX.

Keeping discussion quality high as social usage grows is also non-trivial. Threaded discussions and feeds are easy to add mechanically, but harder to keep useful and contextual for serious mathematical work.

On the frontend, editor and math UX integration took real work. Monaco, KaTeX, PDF.js, mentions, and AI workflows all had to coexist in one coherent workspace.

Finally, coordinating eight services locally, plus environment wiring, storage, and background workers, made `docker-compose.yml` and the `Makefile` central to day to day development.

## Accomplishments that we're proud of

We built a workflow where informal ideas, discussion, and verification live together instead of being split across tools. The canvas makes dependency structure visible and editable, which matches how proofs are actually developed.

The Lean runner gives a clear, repeatable verification step behind a simple HTTP interface, and caching makes it usable under real iteration speed.

We kept orchestration deterministic. In this codebase, the orchestrator is explicit Python control flow in `mesh/backend/orchestrator.py`. Model calls are delegated to the runtime and verification is delegated to the Lean runner. That separation makes the system debuggable and costs predictable.

$
\text{Unpredictable loops} \rightarrow \text{Unpredictable bills}
$

We also shipped social primitives as part of the core product rather than bolting them on later. Activity, discussions, notifications, and mentions are treated as first class, because collaboration in math is social as much as it is technical.

## What we learned

Formal verification is binary. Lean 4 enforces exactness, and something can look mathematically reasonable and still fail to type-check. That gap between informal reasoning and formal code is exactly where assisted formalization helps most.

Specialized agent roles work better than a single generic assistant. In the current runtime, responsibilities are split into explorer, formalizer, critic, and LaTeX assistant roles.

The orchestrator should stay deterministic. Letting a model decide when to call models leads to loops and unpredictable costs. Explicit control flow keeps the system reliable.

Math collaboration is social, not only technical. Proving work needs discussion threads, feedback loops, teams, and visibility into who did what. The product had to support that layer directly instead of treating it as an afterthought.

$
\text{Math tooling} = \text{Technical rigor} + \text{Human coordination}
$

## What's next for ProofMesh

Near-term priorities follow directly from the current architecture. We want stronger semantic retrieval across library, canvas, and discussion context. We want tighter Lean plus library interoperability so formal results can flow into reusable library items with less manual glue. We also want better social-context ranking so discussions and feed activity stay mathematically useful as usage grows.

On the engineering side, we need better end to end evaluation and test coverage for AI-assisted flows, with real metrics tied to verification outcomes rather than subjective “looks good” outputs.

If you want a final smile line that stays on theme:

$
\text{If it compiles, it collaborates}
$