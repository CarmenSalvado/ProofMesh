# ProofMesh — Design Guide

This document defines the UI/UX design principles for ProofMesh.
It exists to support human reasoning under the rules in `CLAUDE.md`.

If a design choice conflicts with human control, traceability, or cognitive clarity, it is wrong.

---

## 1. Design Philosophy

### 1.1 ProofMesh is a reasoning workspace, not an app

ProofMesh should feel like a mathematical notebook + lab bench, not a chat UI.

The UI must:

- reduce cognitive load
- make epistemic status visible
- reinforce human control at all times

The UI must NOT:

- guide the user
- suggest conclusions
- blur authorship

Silence and restraint are features.

---

### 1.2 Human-first power dynamic

The interface must make the following obvious without explanation:

- The human owns the workspace
- Agents (when present) are external contributors
- Nothing enters a notebook automatically

If the UI ever makes an agent feel co-equal to the human, the design has failed.

---

### 1.3 Minimalism as discipline

Minimalism here is operational minimalism.

Every visible element must justify its existence by answering:

> Does this help the human think?

If not, remove it.

---

## 2. Visual Language

### 2.1 Color system (semantic, not decorative)

Color is reserved for meaning, not branding.

Base palette:

- Background: off-white / very light gray
- Primary text: near-black
- Borders/dividers: soft neutral gray

Semantic colors (muted):

- Blue: focus / selection
- Green: verified
- Amber: proposed / tentative
- Red: rejected / failure

Rules:

- No gradients
- No glow
- No saturated colors
- Color must always map to state

---

### 2.2 Typography

Typography is the primary visual affordance.

Recommended:

- Text: Inter / SF Pro / Geist
- Math: KaTeX / Computer Modern
- Code & logs: JetBrains Mono

Rules:

- Generous base font size (16–17px)
- High line-height
- No decorative fonts
- Consistent rhythm across notebook cells

Typography is the main source of elegance.

---

## 3. Layout Principles

### 3.1 Notebook-centric layout

The notebook is the primary object of attention.

- Single central column
- Max width ~720–860px depending on viewport
- Vertical flow only
- No internal pagination

Side panels must never compete visually with the notebook.

---

### 3.2 Persistent structure

The UI structure must feel stable:

- No floating elements
- No jumping layouts
- No modal-heavy flows

Stability reduces cognitive overhead during deep reasoning.

---

## 4. The Notebook

### 4.1 Notebook as a live thinking surface

The notebook is a cell-based document.

Each cell is:

- explicitly authored
- traceable
- human-controlled

The UI must communicate cell boundaries without visual noise.

---

### 4.2 Cell type differentiation

Cell types must be distinguishable at a glance.

Visual cues may include:

- subtle backgrounds
- left borders
- badges
- spacing differences

Required distinctions (at minimum):

- markdown
- code
- output

Agent-derived content must never visually masquerade as human-written content.

---

### 4.3 Explicit insertion

When a human inserts content:

- the action must be intentional
- the result must be visible
- the origin must remain inspectable

No silent insertions. Ever.

---

## 5. The Library

### 5.1 The library is cumulative memory

The library represents accumulated knowledge, not drafts.

It should feel like:

- an archive
- a reference index
- a growing body of results

Not like a feed or dashboard.

---

### 5.2 Status visibility

Every library item must clearly show:

- kind (lemma, claim, etc.)
- status (proposed, verified, rejected)
- authorship

Verification status must be impossible to miss.

---

## 6. Motion & Interaction

### 6.1 Motion rules

Motion is allowed only when it communicates state change.

Permitted:

- subtle insertion animations
- focus transitions

Forbidden:

- decorative animation
- attention-seeking effects
- playful micro-interactions

---

## 7. Anti-Goals (Design)

The UI must never:

- resemble a chat interface
- anthropomorphize agents
- auto-merge content
- obscure provenance

---

## 8. Final Design Test

Before approving any UI change, ask:

- Does this preserve human control?
- Is epistemic status explicit?
- Is authorship unambiguous?
- Does this reduce cognitive load?

If any answer is no, the change must be rejected.
