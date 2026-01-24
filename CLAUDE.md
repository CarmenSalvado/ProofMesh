# PROOFMESH — CLAUDE.md

This file is **authoritative**. If something is not allowed here, you do not do it. If something is allowed here, you have full freedom to implement it **however you want**, as long as it works and respects the rules below.

This is an **aggressive, speed-first, correctness-aware MVP**. No polish fetish. No overengineering. No academic cosplay.

---

## 0. PRODUCT GOAL (NON‑NEGOTIABLE)

ProofMesh is a **human‑controlled reasoning workspace**.

* Humans think in a **Notion‑like Markdown canvas**, line by line.
* Mathematics is written naturally and rendered immediately.
* Agents live in their own space and **propose results**.
* Knowledge is accumulated in a **problem‑scoped library**.

This is **not**:

* a chat app
* an auto‑solver
* a proof assistant replacement
* a social network

If your implementation drifts toward any of those, it is wrong.

---

## 1. CORE POWER DYNAMIC (DO NOT BREAK THIS)

### Absolute rules

1. **The canvas belongs to the human.**

   * Agents NEVER edit the canvas directly.

2. **Insertion is explicit.**

   * Nothing enters the canvas unless a human clicks “insert”.

3. **Publishing rules**

   * Humans MAY publish their discoveries.
   * Agents ALWAYS publish their discoveries (as `proposed`).

4. **Everything is traceable.**

   * Author, origin, time, status. No anonymous blobs.

Break any of these and the system collapses conceptually.

---

## 2. MENTAL MODEL (IF YOU DON’T GET THIS, STOP)

### Hierarchy

* **Problem**

  * owns a **Library** (shared memory)
  * owns MANY **Canvases** (parallel explorations)

* **Canvas**

  * a live Markdown document
  * where humans think

* **Library**

  * where results live
  * reusable, referenceable, verifiable

Canvases are disposable. The library is cumulative.

---

## 3. THE CANVAS (FROZEN DESIGN)

### What it is

* A Markdown document rendered line‑by‑line (Notion style).
* Each line is a first‑class object with a stable ID.
* Math renders immediately.

### Internal representation (minimum)

Each line MUST have:

* `line_id` (UUID)
* `canvas_id`
* `order_key` (fractional / lexicographic ordering)
* `type`
* `content`
* `author_type`: `human | agent`
* `author_id`
* timestamps

### Line types (MVP — DO NOT ADD MORE)

1. `text`

   * Plain Markdown.

2. `math`

   * Stores **LaTeX** (required).
   * Optional MathJSON if you use MathLive.

3. `goal`

   * The current objective.
   * At most ONE active per canvas.

4. `agent_insert`

   * Content coming from an agent run.
   * Inserted ONLY by human action.
   * Keeps reference to `agent_run_id`.

5. `library_ref`

   * Reference to a library item.
   * NOT editable.
   * Removing it removes the reference, not the item.

6. `verification`

   * Logs + status from checker / Lean.

### Editing rules

* Humans can edit/delete anything EXCEPT:

  * `library_ref` content
* Editing an `agent_insert` converts it into a human line and preserves attribution via metadata (`derived_from`).

---

## 4. MULTIPLE CANVASES (THIS IS A FEATURE, NOT A NICE‑TO‑HAVE)

* A user can create unlimited canvases per problem.
* All canvases share the same problem library.
* Canvases do NOT automatically merge.

This enables:

* parallel approaches
* dead‑end exploration
* comparison of reasoning paths

If you accidentally create “one canvas per problem”, you broke the design.

---

## 5. THE LIBRARY (PROBLEM‑SCOPED MEMORY)

### What lives here

* lemmas
* claims
* counterexamples
* computations
* notes

### `LibraryItem` minimum schema

* `library_item_id`
* `problem_id`
* `title`
* `kind`: `lemma | claim | counterexample | computation | note`
* `content` (Markdown + LaTeX)
* `status`: `proposed | verified | rejected`
* `authors` (humans and/or agents)
* `source` (canvas + line OR agent_run)
* `dependencies` (library_item_ids)
* `verification` (method, logs, status)

### Publishing rules

* Human publishing is ALWAYS explicit.
* Agent publishing is AUTOMATIC.
* Agent‑published items default to `proposed`.
* NOTHING becomes `verified` without a verifier.

---

## 6. AGENTS (YOU WORK FOR THE HUMAN)

### Agent constraints

Agents:

* read the problem
* read the current canvas (or selection)
* read the problem library

Agents NEVER:

* edit canvases
* mark things as verified
* decide what is important

### Agent output contract (STRICT JSON)

Every agent run MUST return:

* `summary`
* `proposals[]`

  * `{ title, kind, content_markdown, dependencies?, suggested_verification? }`
* `publish[]` (usually == proposals)
* `notes` (uncertainty, assumptions, risks)

No free‑form essays. No chatty text.

---

## 7. AGENT PANEL (SEPARATE SPACE)

The agent UI must show:

* run status (queued / running / failed / done)
* tool logs
* proposed results

Each proposal must have:

* Insert into canvas
* Open in library

No automatic insertion. Ever.

---

## 8. VERIFICATION (OBJECTIVE TRUTH)

### Mandatory (MVP)

* Python checker
* Deterministic
* Sandboxed
* Time‑limited

### Optional (WOW FACTOR)

* Lean 4 in Docker
* Only for small demo lemmas

### UI behavior

* Verification results appear as `verification` lines.
* Library status updates ONLY after verification passes.

---

## 9. STACK (FREEDOM WITH BOUNDARIES)

### Backend (preferred)

* Python 3.12+
* FastAPI
* Pydantic v2
* PostgreSQL
* Redis (jobs)

### Frontend

* Next.js (App Router)
* TypeScript
* Markdown renderer
* MathLive or equivalent for math input

### Agents

* Google ADK (Python)
* Gemini models

Implementation details are free **as long as behavior matches this spec**.

---

## 10. API SHAPE (MINIMUM VIABLE)

You are free to design routes, BUT the system must support:

* create/list problems
* create/list canvases per problem
* CRUD canvas lines
* create agent runs
* read agent outputs
* publish library items
* insert library items into canvas
* run verification

If any of these are missing, the product is incomplete.

---

## 11. ENGINEERING STYLE

* Small commits
* Working > beautiful
* No speculative abstractions
* No silent magic

If something is clever but opaque, delete it.

---

## 12. HARD ANTI‑GOALS

DO NOT:

* turn this into a chat interface
* let agents write directly into the canvas
* auto‑merge agent output
* hide verification failures
* centralize everything into one canvas

---

## 13. FINAL CHECK (ASK YOURSELF)

Before considering something “done”, ask:

* Does the human stay in control?
* Is knowledge accumulated, not overwritten?
* Can this reasoning be reused later?
* Is every action attributable?

If the answer to any is “no”, fix it.

---

If you want to change the rules above, you must **propose it explicitly** with:

* what changes
* why
* what breaks
* cost to implement

Otherwise: follow this file.
