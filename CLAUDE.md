# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in natural language; Claude AI generates working component code in real-time via a virtual file system, with Monaco editor and iframe-based live preview.

## Commands

```bash
npm run setup          # Install deps + Prisma generate + DB migrations (first-time setup)
npm run dev            # Start dev server (Turbopack)
npm run build          # Production build
npm run lint           # ESLint
npm run test           # Vitest unit tests
npm run db:reset       # Force reset Prisma database
```

## Architecture

### Tech Stack
- **Next.js 15** (App Router) + React 19 + TypeScript
- **Vercel AI SDK** with Anthropic Claude for streaming tool-use responses
- **Prisma + SQLite** for user/project persistence
- **Monaco Editor** for in-browser code editing
- **shadcn/ui** + Tailwind CSS v4 for UI

### Virtual File System
The core abstraction is `src/lib/file-system.ts` — an in-memory `VirtualFileSystem` class. No files are written to disk during generation; all file state lives in memory and is serialized to JSON in the `Project.data` DB column. `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`) wraps this for React state.

### AI Integration (`src/app/api/chat/route.ts`)
The chat API route streams Claude responses using `streamText` with two tools:
- **`str_replace_editor`** (`src/lib/tools/str-replace.ts`) — targeted code replacement, similar to Claude's built-in editor
- **`file_manager`** (`src/lib/tools/file-manager.ts`) — rename/delete files in the virtual FS

The system prompt lives in `src/lib/prompts/generation.tsx`. On stream completion, project state is persisted to Prisma if the user is authenticated.

### Live Preview (`src/components/preview/PreviewFrame.tsx`)
Renders an iframe that runs Babel standalone to execute JSX/TSX from the virtual FS. The `jsx-transformer` (`src/lib/transform/jsx-transformer.ts`) resolves `@/` import aliases to local virtual files before passing to Babel.

### Authentication
JWT sessions stored in httpOnly cookies via `jose`. `src/middleware.ts` protects routes. Anonymous users work without login — their projects are tracked via `src/lib/anon-work-tracker.ts` but not persisted.

### Data Flow
1. User message → POST `/api/chat` with full virtual FS state
2. Claude streams tool calls → virtual FS updates → preview re-renders
3. On completion → project state saved to `Project.messages` + `Project.data` columns

### State Management
- `FileSystemContext` — virtual FS and file operations
- `ChatContext` — chat messages, input, streaming status
- Server actions in `src/actions/` handle DB operations

### Key Path Alias
`@/*` maps to `./src/*` (defined in `tsconfig.json`).

## Database Schema

The full schema is defined in `prisma/schema.prisma` — reference it to understand the structure of all data stored in the database.

## Code Style

Use comments sparingly — only for complex or non-obvious logic.

## Testing

Unit tests live in `__tests__/` folders alongside components (`components/chat/`, `components/editor/`, `lib/transform/`). Run with `npm run test`.
