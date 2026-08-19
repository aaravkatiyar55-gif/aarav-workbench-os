# Aarav Workbench OS — Testing Record

This file records observed results only. A planned check is not a pass.

| Area | Environment | Result | Notes |
| --- | --- | --- | --- |
| JavaScript syntax | Local | Passed | `npm run check` completed after the drag guard update. |
| Whitespace / patch safety | Local | Passed | `git diff --check` completed with no output. |
| Five draggable windows | Local browser | Passed | Each title bar was moved with a real pointer drag. A title-bar click was also checked not to move a window. |
| Close, minimize, restore | Local browser | Passed | Build Notes minimized then restored from the dock; Toolbox closed then restored from the dock. |
| Clock and theme persistence | Local browser | Passed | Theme changed, page reloaded, and the saved paper theme was restored. The live clock was visible in the top bar. |
| Workspace snapshot persistence | Local browser | Passed | A dragged Project Shelf position persisted in a fresh local browser page; Save workspace was activated. |
| Command Dock | Local browser | Passed | `Ctrl` + `K`, command filtering, Enter to open Workspace Snapshot, and Escape to close were checked. |
| Keyboard movement | Local browser | Passed | A focused Project Shelf title bar moved 24px right with `Alt` + Right Arrow while keeping its saved top value. |
| Runtime console | Local browser | Passed | Browser error log was empty after the interaction checks. |
| Project Shelf links | Local network check | Passed | Seven listed source/demo URLs returned HTTP 200; Aarav Ping Bot is intentionally source-only. |
| Responsive layout | Source + local browser | Partially checked | Mobile stacking and reduced-motion media rules are source-checked. The test browser did not apply its requested 360/768/1280/1440 viewport override, so those exact runtime widths remain pending. |
| Deployed website | Public GitHub Pages | Pending | Fresh-page check after deployment. |
