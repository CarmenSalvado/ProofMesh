# PROOFMESH — CLAUDE.md

This file is authoritative. If something is not allowed here, you do not do it. If something is allowed here, you have full freedom to implement it however you want, as long as it works and respects the rules below.

This is a speed-first, correctness-aware MVP. No polish fetish. No overengineering.

---

## 0. PRODUCT GOAL (NON-NEGOTIABLE)

ProofMesh is a human-controlled reasoning workspace built around a markdown-first editor.

- Humans think inside a structured markdown workspace.
- Math is written naturally and rendered immediately.
- Knowledge is accumulated in a problem-scoped library.

This is NOT:

- a chat app
- an auto-solver
- a proof assistant replacement
- a social network

If the implementation drifts toward any of those, it is wrong.

---

## 1. CORE POWER DYNAMIC (DO NOT BREAK THIS)

### Absolute rules

1. The workspace belongs to the human.
   - Agents NEVER edit notebooks or files directly.

2. Insertion is explicit.
   - Nothing enters a notebook unless a human accepts or inserts it.

3. Publishing rules
   - Humans MAY publish their discoveries.
   - Agents ALWAYS publish their discoveries (as proposed).

4. Everything is traceable.
   - Author, origin, time, status. No anonymous blobs.

Break any of these and the system collapses conceptually.

---

## 2. MENTAL MODEL (IF YOU DON'T GET THIS, STOP)

### Hierarchy

- Problem
  - owns a Library (shared memory)
  - owns a Workspace (markdown-backed)

- Workspace
  - a file system with markdown and supporting files
  - where humans think

- Library
  - where results live
  - reusable, referenceable, verifiable

Workspaces are disposable. The library is cumulative.

---

## 3. THE WORKSPACE (MARKDOWN EDITOR)

### What it is

- A markdown workspace embedded in the app.
- Markdown (.md) is the primary thinking surface.
- Supporting files are first-class, too.

### Internal representation (minimum)

We store workspace files through the workspace contents API.

Each file record MUST have:

- problem_id
- path
- type: directory | file
- content (text, usually markdown)
- format: text | markdown
- timestamps

No line-by-line canvas model. The unit of storage is the file.

---

## 4. THE LIBRARY (PROBLEM-SCOPED MEMORY)

### What lives here

- lemmas
- claims
- counterexamples
- computations
- notes

### LibraryItem minimum schema

- library_item_id
- problem_id
- title
- kind: lemma | claim | counterexample | computation | note
- content (Markdown + LaTeX)
- status: proposed | verified | rejected
- authors (humans and/or agents)
- source (file path, cell id, or agent run)
- dependencies (library_item_ids)
- verification (method, logs, status)

### Publishing rules

- Human publishing is ALWAYS explicit.
- Agent publishing is AUTOMATIC.
- Agent-published items default to proposed.
- NOTHING becomes verified without a verifier.

---

## 5. AGENTS (DEFERRED FOR NOW)

Agent integration is out of scope for the current MVP. When added, it MUST respect the power dynamic above.

---

## 6. VERIFICATION (DEFERRED FOR NOW)

Verification is optional for the current MVP. When added, it MUST be deterministic, sandboxed, and traceable.

---

## 7. STACK (BOUNDARIES)

### Backend (preferred)

- Python 3.12+
- FastAPI
- Pydantic v2
- PostgreSQL

### Frontend

- Next.js (App Router)
- TypeScript
- Milkdown Crepe (embedded)

---

## 8. API SHAPE (MINIMUM VIABLE)

The system must support:

- create/list problems
- workspace contents API (markdown store)
- CRUD files and directories
- publish library items

---

## 9. ENGINEERING STYLE

- Small commits
- Working > beautiful
- No speculative abstractions
- No silent magic

If something is clever but opaque, delete it.

---

## 10. HARD ANTI-GOALS

DO NOT:

- turn this into a chat interface
- let agents write directly into notebooks
- auto-merge agent output
- hide verification failures

---

## 11. FINAL CHECK (ASK YOURSELF)

Before considering something done, ask:

- Does the human stay in control?
- Is knowledge accumulated, not overwritten?
- Can this reasoning be reused later?
- Is every action attributable?

If the answer to any is no, fix it.
