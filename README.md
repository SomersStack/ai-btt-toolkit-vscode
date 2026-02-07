# Workflow — VS Code Extension

A VS Code extension that provides a sidebar UI for managing AI-assisted development workflows. It integrates with two CLI tools:

- **GWT** (`ai-git-worktrees`) — AI-powered git worktree management
- **Clier** (`clier-ai`) — Pipeline and process management daemon

## Features

- **Worktree Management** — Create, merge, delete, and browse git worktrees from the sidebar. Enriched with live status from GWT including Claude agent activity and diff stats.
- **Pipeline Control** — Start, stop, and monitor Clier daemon processes. View logs, send input, and organise processes by stage.
- **Claude Integration** — Launch Claude CLI sessions directly from the sidebar in interactive, commit, or YOLO mode.
- **Task Splitting** — Split tasks into parallel GWT worktree sessions with configurable model, budget, and base ref.
- **Auto-Refresh** — File watchers on `.git/worktrees/` and `clier-pipeline.json`, plus polling, keep the UI in sync.

## Project Structure

```
src/
├── extension.ts              # Activation, view registration, command wiring
├── types.ts                  # Shared TypeScript interfaces
├── worktrees/
│   ├── worktreeProvider.ts   # TreeDataProvider for git worktrees
│   ├── worktreeCommands.ts   # Create, merge, delete, open, session commands
│   ├── worktreeItems.ts      # Tree item UI (icons, labels, tooltips)
│   └── worktreeParser.ts     # Parses `git worktree list --porcelain`
├── clier/
│   ├── clierProvider.ts      # TreeDataProvider for Clier processes
│   ├── clierCommands.ts      # Daemon and process lifecycle commands
│   ├── clierItems.ts         # Tree item UI for daemon, stages, processes
│   └── clierParser.ts        # Parses `clier status --json`
├── tools/
│   ├── toolsProvider.ts      # TreeDataProvider for Claude tool shortcuts
│   ├── toolsCommands.ts      # Claude session launchers
│   └── toolsItems.ts         # Tree items for each tool mode
├── utils/
│   ├── exec.ts               # Spawns CLI commands with timeout and PATH setup
│   ├── workspace.ts          # Workspace root helpers
│   └── gwtOptions.ts         # Multi-step picker for GWT launch options
└── common/
    └── installItem.ts        # "Install" prompt item for missing CLIs
```

## Prerequisites

- **Node.js** 18+
- **VS Code** 1.85.0+
- **GWT** (`ai-git-worktrees`) — install globally for worktree features
- **Clier** (`clier-ai`) — install globally for pipeline features

The extension gracefully degrades when either CLI is missing, showing an install prompt in the relevant sidebar section.

## Installation

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile
```

### Run in development

Open the project in VS Code and press **F5** to launch an Extension Development Host with the extension loaded.

### Package as .vsix

```bash
# Install vsce if you don't have it
npm install -g @vscode/vsce

# Package
vsce package
```

Then install the resulting `.vsix` file via **Extensions > ... > Install from VSIX** in VS Code.

## Build Scripts

| Script                    | Description                          |
|---------------------------|--------------------------------------|
| `npm run compile`         | Compile TypeScript to `out/`         |
| `npm run watch`           | Compile in watch mode                |
| `npm run vscode:prepublish` | Pre-publish hook (runs compile)   |
