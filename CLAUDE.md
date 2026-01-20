# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mattoni is a privacy-first personal finance budgeting app with a React frontend, Express backend, and Electron desktop app. "Mattoni" means "bricks" in Italian.

## Common Commands

```bash
# Install all dependencies (client, server, root)
npm run install:all

# Development - web version (starts both client:5173 and server:3001)
npm run dev

# Development - Electron desktop app
npm run electron:install   # First time only
npm run electron:dev       # Builds client then runs Electron

# Build
npm run build              # Build client + server
npm run electron:dist      # Build .dmg for macOS

# Production
npm start                  # Run Express server with built client
docker-compose up -d       # Docker deployment
```

Individual commands:
- `npm run dev:client` - Vite dev server only (port 5173)
- `npm run dev:server` - Express server only (port 3001)
- `cd client && npm run preview` - Preview production build

## Architecture

### Three-Layer Monorepo

```
client/   → React 18 + TypeScript + Vite (port 5173)
server/   → Express + better-sqlite3 (port 3001)
electron/ → Electron with embedded Express server
```

The Electron app embeds the full Express server in its main process - no separate Node server needed on desktop.

### Data Model

```
Sections (income/expense)
  └── Groups (can be disabled for scenarios)
        └── Components (can be disabled for scenarios)
              └── BudgetValues (year, month, amount)
              └── BudgetNotes (year, month, note_text)
```

### Multi-Budget Support

Each budget is a separate SQLite database file. Desktop stores data in `~/Library/Application Support/Mattoni/`:
- `metadata.json` - Budget list and last selected
- `budget-{uuid}.db` - Individual budget databases

### Key Frontend Components

- `App.tsx` - Main orchestrator, routes between welcome/budget views
- `BudgetTable/` - Monthly grid display with Excel-like editing
- `TreeSidebar/` - Hierarchical structure editor with @dnd-kit drag-and-drop
- `EditDrawer/` - Side panel for component details

### API Routes

All routes prefixed with `/api/`. Key endpoints:
- `/budgets` - Budget file management (list, create, switch, delete)
- `/sections` - Returns full hierarchy (sections → groups → components)
- `/budget/:year` - Budget values for a year
- `/notes/:year` - Notes for budget cells
- `/groups`, `/components` - CRUD + reorder operations

### State Management

- React hooks for UI state
- localStorage for UX persistence (expanded sections, selected component)
- SQLite as single source of truth

### Vite Proxy

In development, Vite proxies `/api/*` requests to `http://localhost:3001/api/*`.

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, @dnd-kit (drag-drop), marked (markdown)
- **Backend**: Express, better-sqlite3, TypeScript
- **Desktop**: Electron 33, electron-builder
- **Runtime**: Node.js 18+
