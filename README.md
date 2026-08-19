# Aarav Workbench OS

A browser-based project desk for exploring Aarav's small tools, build notes, and practical toolbox through movable windows.

## What it does

Aarav Workbench OS is a local-first personal WebOS. Visitors can open and move project windows, search the project shelf, use a keyboard Command Dock, switch themes, and save a window layout in their own browser.

It does not use accounts, passwords, a server, analytics, or external APIs.

## Features

- Multiple draggable, closable, minimizable windows
- Live local clock and a responsive desktop top bar
- Project Shelf with source and demo links for documented projects
- Build Notes and Toolbox windows
- Command Dock with `Ctrl`/`Cmd` + `K`
- `Alt` + arrow-key movement for the focused window title bar
- Local workspace snapshot, theme preference, and reset layout
- Mobile stacked-window layout and reduced-motion support

## Run locally

No dependency installation is required.

1. Open this folder in VS Code.
2. Start a local static server, for example:

   ```powershell
   py -m http.server 4173
   ```

3. Open `http://127.0.0.1:4173` in a browser.

## Test plan

Run the source check:

```powershell
npm run check
git diff --check
```

Then test dragging, close/minimize/restore, Command Dock, `Alt` + arrow movement, refresh persistence, keyboard navigation, and the mobile stacked layout. The exact observed results are kept in [TESTING.md](TESTING.md).

## Deployment

The public demo is deployed on GitHub Pages:

- https://aaravkatiyar55-gif.github.io/aarav-workbench-os/

It is a public, password-free static page. The deployed page is checked in a fresh browser page after each release.

## Screenshot

The image below is a real capture of the deployed desktop, with four independently draggable app windows visible.

![Aarav Workbench OS with Start Here, Project Shelf, Build Notes, and Toolbox windows open](docs/screenshots/aarav-workbench-os-deployed.png)

## Privacy

The app stores only namespaced workspace layout and theme preferences in browser `localStorage` keys beginning with `aarav-workbench-os.`. It does not collect, send, or require personal information.

## AI usage

OpenAI Codex is being used for planning, implementation support, testing guidance, and deployment setup. The project’s Stardance declaration, README, devlogs, and test evidence will describe the actual work performed and will not claim unverified behavior or human-only authorship.

## Current status

The local implementation and first public deployment are complete. Live-link verification, a clean deployed screenshot, factual devlogs, project-info evidence, and final Stardance ship readiness are tracked separately and are added only when actually completed.
