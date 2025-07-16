# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Tauri + React + TypeScript desktop application. The project combines a Rust backend (Tauri) with a React frontend using Vite as the build tool.

## Architecture

- **Frontend**: React 18 with TypeScript in `src/` directory
- **Backend**: Rust Tauri application in `src-tauri/` directory  
- **Build Tool**: Vite for frontend bundling
- **Package Manager**: pnpm (configured in tauri.conf.json)

## Development Commands

- `pnpm tauri dev` - Start Tauri development mode with hot reload
- `pnpm build` - Build for production (TypeScript compilation + Vite build)
- `pnpm preview` - Preview production build
- `pnpm tauri` - Run Tauri CLI commands

## Tauri-specific Commands

- `pnpm tauri dev` - Start Tauri development mode
- `pnpm tauri build` - Build Tauri application for distribution
- `cargo check` - Check Rust compilation (run from `src-tauri/`)
- `npx tsc --noEmit` - Check TypeScript compilation

## shadcn/ui Integration

**IMPORTANT**: When running shadcn/ui commands, always use:
- `pnpm dlx shadcn@latest ...` for general commands
- `pnpm dlx shadcn@latest add <components...>` for adding components specifically

## Frontend Architecture

- Entry point: `src/main.tsx`
- Main component: `src/App.tsx` 
- Tauri API integration via `@tauri-apps/api/core`
- Development server runs on port 1420
- HMR on port 1421

## Backend Architecture

- Main Rust entry: `src-tauri/src/main.rs`
- Library: `src-tauri/src/lib.rs`
- Tauri configuration: `src-tauri/tauri.conf.json`
- Build script: `src-tauri/build.rs`

## Documentation

The `docs/shadcn-ui/` directory contains MDX documentation for various shadcn/ui components, suggesting this project may be using or planning to use shadcn/ui component library.

## Safety and Warnings

- Never, **EVER** run _any_ `pnpm tauri *` commands.  _Not even with flags like `--no-watch`!!!_
