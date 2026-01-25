# Frontend Architecture & Component Guide

This document describes the technical architecture of the ProofMesh frontend (Next.js 14 App Router).

## 1. Directory Structure

```
src/app/
├── (dashboard)/        # Root layout group (Home, Dashboard)
├── problems/[id]/      # Nested layout group for Workspace context
│   ├── layout.tsx      # Provides ProblemSidebar + Flex Wrapper
│   ├── page.tsx        # Problem Home (Overview)
│   └── canvas/
│       └── [canvasId]/ # Canvas Editor with ToolsPanel
```

## 2. Layout Strategy

### Global Layout vs Problem Layout
We use a nested layout strategy to separate the "Global" context (Dashboard) from the "Deep Work" context (Problem/Workspace).

- **Global Context**: Uses `WorkspaceSidebar` (to be renamed `DashboardSidebar` in future refactors). Focuses on navigation between problems.
- **Problem Context**: Uses `ProblemSidebar`. Focuses on navigation *within* a problem (Canvases, Library).

### Problem Layout (`problems/[id]/layout.tsx`)
This server component wraps the problem context. It renders:
1. `ProblemSidebar`: A client component fetching problem-specific data (canvases list).
2. `children`: The main content area (Canvas Editor or Problem Home).

## 3. Key Components

### ProblemSidebar (`components/layout/ProblemSidebar.tsx`)
- **Responsibility**: Contextual navigation.
- **Data**: Fetches `Problem`, `Canvases`, and `LibraryItems`.
- **Style**: Minimalist, Notion-inspired "Drafts" list.
- **Actions**: "New Canvas", "Back to Dashboard".

### ToolsPanel (`components/layout/ToolsPanel.tsx`)
- **Responsibility**: Auxiliary tools and AI assistance.
- **State**: Manages Tabs (`assist` | `tools`).
- **Tabs**:
    - **Assist**: Renders `OrchestrationPanel` (Chat & Agent Status).
    - **Tools**: Renders `SymbolsPalette` and `DetectedObjects` (Library preview).

### OrchestrationPanel (`components/agents/OrchestrationPanel.tsx`)
- **Responsibility**: Chat interface for Backend Agents.
- **Modes**:
    - `embedded=true`: Minimal UI, fits inside `ToolsPanel`.
    - `embedded=false`: Standalone sidebar (legacy mode).

### CanvasPage (`problems/[id]/canvas/[canvasId]/page.tsx`)
- **Responsibility**: The main editor interface.
- **Layout**: CSS Grid/Flex.
    - Left: `ProblemSidebar` (from parent layout).
    - Center: Editor/Preview Split.
    - Right: `ToolsPanel`.

## 4. State Management

- **Server State**: React Server Components (fetching Problem metadata).
- **Client State**:
    - `useState`: Local UI state (tabs, view modes, inputs).
    - `useWebSocket`: Real-time agent communication and logs.
    - `useAuth`: User session.

## 5. Styling System

- **Tailwind CSS**: Utility classes for structure.
- **CSS Variables**: Theme definitions (colors, fonts).
- **Dark Mode**: Fully supported via variables (`--bg-primary`, `--text-primary`, etc.).

### Critical Theme Variables
- `--bg-secondary`: Sidebar backgrounds.
- `--bg-primary`: Main editor background.
- `--border-primary`: Subtle dividers.
- `--text-faint`: Low contrast labels.
