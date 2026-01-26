# Frontend Architecture & Component Guide

This document describes the technical architecture of the ProofMesh frontend (Next.js App Router).

## 1. Directory Structure

```
src/app/
├── (dashboard)/        # Root layout group (Home, Dashboard)
├── problems/[id]/      # Nested layout group for Workspace context
│   ├── layout.tsx      # Flex wrapper for workspace pages
│   ├── page.tsx        # Workspace overview
│   └── lab/            # Markdown workspace (Milkdown Crepe)
```

## 2. Layout Strategy

### Global Layout vs Workspace Layout
We use a nested layout strategy to separate the "Global" context (Dashboard) from the "Deep Work" context (Workspace/Lab).

- **Global Context**: Uses `WorkspaceSidebar`. Focuses on navigation between workspaces.
- **Workspace Context**: A lightweight wrapper around the markdown workspace surface.

### Workspace Layout (`problems/[id]/layout.tsx`)
This layout wraps workspace pages with a simple flex container. The main work surface is the workspace editor.

## 3. Key Components

### WorkspaceHeader (`components/layout/WorkspaceHeader.tsx`)
- **Responsibility**: Breadcrumbs + workspace context.

### LabPage (`problems/[id]/lab/page.tsx`)
- **Responsibility**: Renders the ProofMesh workspace UI and Milkdown Crepe editor.
- **Integration**: Stores markdown in the workspace contents API (`workspace.md`).

## 4. State Management

- **Server State**: React Server Components (fetching Problem metadata).
- **Client State**:
    - `useState`: Local UI state.
    - `useAuth`: User session.

## 5. Styling System

- **Tailwind CSS**: Utility classes for structure.
- **CSS Variables**: Theme definitions (colors, fonts).
- **Dark Mode**: Fully supported via variables (`--bg-primary`, `--text-primary`, etc.).

### Critical Theme Variables
- `--bg-secondary`: Sidebar backgrounds.
- `--bg-primary`: Main workspace background.
- `--border-primary`: Subtle dividers.
- `--text-faint`: Low contrast labels.
