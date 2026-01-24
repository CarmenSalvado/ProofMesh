# ProofMesh — Design Guide

> This document defines the **UI/UX design principles and constraints** for ProofMesh.
> It is not about branding or decoration. It is about **supporting human reasoning** under the rules defined in `CLAUDE.md`.

If a design choice conflicts with human control, traceability, or cognitive clarity, it is wrong — even if it looks good.

---

## 1. Design Philosophy

### 1.1 ProofMesh is a reasoning workspace, not an app

ProofMesh is closer to a **mathematical notebook + lab bench** than to a chat app or productivity tool.

The UI must:

* reduce cognitive load
* make epistemic status visible
* reinforce human control at all times

The UI must *not*:

* guide the user
* suggest conclusions
* blur authorship

Silence and restraint are features.

---

### 1.2 Human-first power dynamic

The interface must make the following obvious without explanation:

* The human owns the canvas
* Agents are external contributors
* Nothing enters the canvas automatically
* Verification is objective and separate

If the UI ever makes an agent feel "co-equal" to the human, the design has failed.

---

### 1.3 Minimalism as discipline

Minimalism here is not aesthetic minimalism — it is **operational minimalism**.

Every visible element must justify its existence by answering:

> Does this help the human think?

If not, remove it.

---

## 2. Visual Language

### 2.1 Color system (semantic, not decorative)

Color is reserved for **meaning**, not branding.

**Base palette**

* Background: off-white / very light gray
* Primary text: near-black
* Borders/dividers: soft neutral gray

**Semantic colors (muted)**

* Blue: focus / selection
* Green: verified
* Amber: proposed / tentative
* Red: rejected / failure

Rules:

* No gradients
* No glow
* No saturated colors
* Color must always map to state

---

### 2.2 Typography

Typography is the primary visual affordance.

Recommended:

* Text: Inter / SF Pro / Geist
* Math: KaTeX / Computer Modern
* Code & logs: JetBrains Mono

Rules:

* Generous base font size (16–17px)
* High line-height
* No decorative fonts
* Consistent rhythm across canvas lines

Typography is the main source of elegance.

---

## 3. Layout Principles

### 3.1 Canvas-centric layout

The canvas is the primary object of attention.

* Single central column
* Max width ~700–750px
* Vertical flow only
* No internal pagination

Side panels must never compete visually with the canvas.

---

### 3.2 Persistent structure

The UI structure must feel stable:

* No floating elements
* No jumping layouts
* No modal-heavy flows

Stability reduces cognitive overhead during deep reasoning.

---

## 4. The Canvas

### 4.1 Canvas as a live thinking surface

The canvas is a **live Markdown document**, rendered line-by-line.

Each line is:

* a first-class object
* explicitly authored
* traceable

The UI must communicate this discretization clearly.

---

### 4.2 Line type differentiation

Line types must be distinguishable *at a glance*.

Visual cues may include:

* subtle background changes
* left borders
* badges
* spacing differences

Required distinctions:

* text
* math
* goal
* agent_insert
* library_ref
* verification

Agent-derived content must never visually masquerade as human-written content.

---

### 4.3 Explicit insertion

When a human inserts content:

* the action must be intentional
* the result must be visible
* the origin must remain inspectable

No silent insertions. Ever.

---

## 5. The Library

### 5.1 The library is cumulative memory

The library represents **accumulated knowledge**, not drafts.

It should feel like:

* an archive
* a reference index
* a growing body of results

Not like a feed or dashboard.

---

### 5.2 Status visibility

Every library item must clearly show:

* kind (lemma, claim, etc.)
* status (proposed, verified, rejected)
* authorship

Verification status must be impossible to miss.

---

### 5.3 References, not duplication

Canvas references to library items must:

* be visually distinct
* be non-editable
* not duplicate content

Removing a reference must not delete the underlying item.

---

## 6. Agent Panel

### 6.1 Psychological separation

The agent panel must feel **separate** from the canvas.

Design cues:

* slightly different background
* smaller typography
* utilitarian layout

The implicit message:

> This is external output, not thought.

---

### 6.2 Proposal handling

Agent outputs are proposals, not conclusions.

Each proposal must support:

* inspection
* insertion into canvas (manual)
* publication to library

Nothing is auto-accepted.

---

## 7. Verification Feedback

### 7.1 Verification is objective

Verification output must feel:

* mechanical
* deterministic
* emotionless

No celebratory UI.

---

### 7.2 Visibility of failure

Verification failures must be:

* visible
* preserved
* traceable

Hiding or softening failures is forbidden.

---

## 8. Motion & Interaction

### 8.1 Motion rules

Motion is allowed only when it communicates state change.

Permitted:

* subtle insertion animations
* focus transitions

Forbidden:

* decorative animation
* attention-seeking effects
* playful micro-interactions

---

## 9. Anti-Goals (Design)

The UI must never:

* resemble a chat interface
* anthropomorphize agents
* auto-merge content
* obscure provenance
* centralize reasoning into a single canvas

If it does, the design violates the product.

---

## 10. Final Design Test

Before approving any UI change, ask:

* Does this preserve human control?
* Is epistemic status explicit?
* Is authorship unambiguous?
* Does this reduce cognitive load?

If any answer is "no", the change must be rejected.
