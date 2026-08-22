# 📖 Aarav's Study Desk

> A clean, distraction-free browser desk designed to help you pick one realistic next study task, jot down scratch notes, and save session handoffs before stepping away.

**Live Demo:** [https://aaravkatiyar55-gif.github.io/aarav-workbench-os/](https://aaravkatiyar55-gif.github.io/aarav-workbench-os/)

---

## Why I Built This

When studying or working on coding projects, the biggest issue I faced wasn't solving a difficult problem—it was the cognitive overwhelm of multitasking across too many apps, browser tabs, and complicated productivity dashboards.

My earlier workbench experiment ended up with 12 movable windows, mini-games, and complex tools. While it was fun to build, in real daily use it felt like an over-engineered operating system rather than a calm place to study.

I wanted a focused, digital study desk inspired by a physical school desk:
- **One Next Action at a time**: A prominent focus card so you always know what single step to do right now, instead of staring at an intimidating 20-item backlog.
- **A lined-paper scratchpad**: An instant place to dump formulas, questions, or quick ideas without opening a heavy note app.
- **Session Handoffs**: A dedicated spot to write *"When I return, first I will..."* before stepping away for lunch or a break, eliminating cold-start friction when returning.
- **5-Minute Study Rescue**: 1-click low-activation prompts to break study hesitation on days when getting started feels difficult.

---

## Architecture & Deliberate Simplification

During development, an earlier iteration explored an OS-style floating taskbar (`window-strip.js`) that dynamically tracked and minimized open windows along the screen bottom. However, practical testing revealed that dynamic floating strips introduced visual clutter, overlapped content on smaller viewports, and added brittle DOM synchronization overhead.

To keep the study desk lightweight and calm, a deliberate simplification was made:
1. **Semantic Header Dock**: Replaced floating taskbars with a fixed, accessible topbar launcher dock (`<nav class="desk-launcher-dock">`) where each window can be toggled directly with clear state indicators (`aria-expanded`).
2. **Central Desk Hub**: When a user opens the desk or closes all active windows, a distraction-free central landing hub (`#desk-hub`) reveals itself, offering instant one-click pathways into any tool.

This architecture ensures predictable window state, zero floating UI overlap, and accessible keyboard navigation without unnecessary JavaScript framework overhead.

---

## The 5 Study Windows

### 1. 🎯 Today's Focus (Window 1)
- Add a study task with estimated duration (5–60 mins) and required energy level (*Low, Medium, High*).
- Displays a prominent **Single Next Action** card pointing directly to your immediate next step.
- Queue list with check-off completion and delete controls. Fresh users start with a completely clean, empty queue.

### 2. 📝 Study Scratchpad (Window 2)
- Lined-paper digital notepad with red margin guide and warm parchment styling.
- Auto-saves keystroke-by-keystroke to `localStorage` with a debounced status indicator.
- Includes a safe "Clear Pad" confirmation dialog.

### 3. 🔄 Session Handoff (Window 3)
- Solves the common problem of forgetting where you were after taking a study break.
- Enter a short sentence describing your stopping point and immediate next action.
- When opening the desk on your next session, a prominent **Resume Banner** appears at the top of the desk with a 1-click button to adopt it as Today's task and clear the consumed handoff.

### 4. ⚡ 5-Minute Study Rescue (Custom Feature)
- Overcomes study procrastination and inertia with three actionable low-friction templates:
  - 📖 *Read 1 Page / Note (5 min · Low energy)*
  - 📐 *Solve 1 Practice Problem (5 min · Medium energy)*
  - 🧹 *Organize Desk & Open Book (5 min · Low energy)*
- Clicking any rescue card immediately injects a 5-minute task into your Today queue and focuses your workspace.

### 5. 📚 Project Shelf (Window 5)
- Quick access to Aarav's projects:
  - **Focus Orbit** (Live Demo & Source: Student Study Dashboard)
  - **Aarav Builds** (Live Demo & Source: Personal Build Journal)
  - **QueueClear** (In local development)
  - **Aarav Ping Bot** (Documented in Aarav Builds)
- Active external links include `target="_blank"` and `rel="noopener noreferrer"` for security.

---

## Design & Visual Theme

- **School Study Desk Aesthetic**: Warm off-white parchment canvas (`#f4f1ea`), deep study forest green and slate navy titlebars (`#1e3a2f` & `#1b263b`), and warm amber highlighter accents (`#d97706`).
- **Physical Dragging**: Window headers support smooth pointer dragging with automatic boundary clamping inside the viewport on both drag and window resize.
- **Quiet Landing**: By default on a fresh visit or reset, all windows start closed and the quiet Desk Hub welcomes the student.
- **Mobile Responsive**: Stacks cleanly in a single vertical column on mobile screens (`<= 640px`) with zero horizontal scroll leakage.
- **High Contrast & Accessible**: 3px amber focus rings (`outline: 3px solid var(--accent-amber)`), semantic landmark HTML, and full keyboard navigation.

---

## Deployment & Local Storage

- **Static Web Application**: Hosted as static files via GitHub Pages and easily run locally using any standard static file server.
- **100% Browser-Local Data**: All state is saved exclusively in the client's browser storage via `localStorage` keys:
  - `studydesk.tasks.v1`
  - `studydesk.scratchpad.v1`
  - `studydesk.handoff.v1`
  - `studydesk.windows.v2`
- **Defensive Storage Normalization**: Built-in validators protect against malformed or corrupted localStorage payloads so the UI never crashes.
- **Zero Backend**: No remote servers, user accounts, authentication tokens, or databases required.
- **Zero Telemetry**: No tracking scripts, analytics, or third-party cookies.

---

## Local Setup

Because the application uses native JavaScript ES Modules (`import`/`export`), it is best run through a local web server:

```bash
# 1. Clone the repository
git clone https://github.com/aaravkatiyar55-gif/aarav-workbench-os.git
cd aarav-workbench-os

# 2. Start a local server (Python 3):
python -m http.server 8000

# Or with Node.js:
npx serve .
```

Then open `http://localhost:8000/` in your browser.

---

## Manual Testing & Verification

The repository includes a comprehensive manual verification test log in [`TESTING.md`](./TESTING.md).

Quick syntax check:
```bash
node --check script.js
node --check projects.js
```

---

## Honest Limitations

- **Single Browser Storage**: Data is saved inside the local browser profile. Clearing your browser cache or switching devices will reset the local desk data.
- **No Cloud Sync**: There is no multi-device synchronization.
- **Static Delivery**: As a standard static web application, network connectivity is required on initial load if accessing via GitHub Pages (unless running from a cloned local folder).
- **Single-User Scope**: Designed as a personal study tool for one student at a desk, not a team collaboration suite.

---

## AI Usage Disclosure

In keeping with honest project transparency:
- **LLM Assistance**: Generative AI tools (LLMs) were used for boilerplate scaffolding, drafting initial CSS/JS code structures, and organizing test matrix documentation in `TESTING.md`.
- **Human Work & Verification**: The core study desk concept, feature reduction from the previous 12-window OS, session handoff workflow, prompt definitions, defensive storage validation rules, and manual test execution were directed and verified by Aarav.

---

## License

MIT License © 2026 Aarav Katiyar. See [`LICENSE`](./LICENSE) for full details.
