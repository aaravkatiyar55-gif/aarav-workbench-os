# Aarav Workbench OS — Testing Record

This file records observed results only. A planned check is not a pass.

| Area | Environment | Result | Notes |
| --- | --- | --- | --- |
| JavaScript syntax | Local | Passed | `npm run check` completed after the local-first expansion. |
| Whitespace / patch safety | Local | Passed | `git diff --check` completed with no reported patch errors. |
| Existing window desktop | Local browser | Passed earlier | Five foundational windows were pointer-dragged; close, minimize, dock restore, Command Dock, `Alt` + arrow movement, layout persistence, and a live clock were previously checked. |
| Notebook persistence | Isolated local browser | Passed | A synthetic title and multiline note persisted through refresh in the `127.0.0.1:4176` test origin. |
| Story Journal persistence | Isolated local browser | Passed | A synthetic non-personal draft persisted through refresh; it remained inside the Journal window only. |
| Writing clear protection | Isolated local browser | Passed | The clear-notebook control opened the exact confirmation dialog; Keep it was selected and the saved content stayed unchanged. |
| Optional voice fallback | Isolated local browser | Passed for denial fallback | Starting voice input showed the browser-denied fallback and typing remained available. No microphone permission was accepted and no real speech transcription is claimed. |
| Theme Lab persistence and console contrast | Isolated local browser | Passed | Moss and quieter motion persisted through refresh; fresh Night-theme check showed the console on a dark fixed surface with distinct light, command, and error text. |
| Legacy theme migration | Source review | Source-checked | Valid legacy Paper/Night values are migrated to `theme.v2`; malformed values fall back to Paper. A seeded legacy-browser runtime test remains pending. |
| Session wallpaper | Source review | Source-checked | PNG/JPEG/WebP type and 4 MB limit are checked; image object URL is memory-only and revoked on reset/unload. A native file-picker selection was not performed, so picker behavior is not claimed. |
| Wallpaper invalid-file message | Source review | Source-checked | An invalid or oversized selection leaves any current temporary wallpaper in place and the status says so; no selected file is retained. |
| Signal Sprint | Isolated local browser | Passed for early, success, and cleanup flows | Too-early state, a measured successful reaction/best score, and stopping an unfinished run when Game Room was minimized were observed. |
| Desk Grid | Isolated local browser | Passed for board, mismatch, match, and focus flows | Board rendered twelve labelled controls; a mismatch recovered after its delay, one matching pair was found, and focus moved to the relevant next card after re-render. A complete six-pair route is still pending. |
| Game-score storage failure | Source review | Source-checked | A game says a local best was saved only when the namespaced browser-storage write succeeds; otherwise it explains that the result could not be saved. |
| Workbench Console | Isolated local browser | Passed | `help`, `theme ember`, `open games`, `status`, `clear`, and unsupported shell-style input were checked through regular input/keyboard interaction. The visible Run button was also clicked for `status` and unsupported PowerShell-style input; the unsupported input produced a local rejection with no console error. |
| Command Dock integration | Isolated local browser | Passed | Searching for Launchpad surfaced its Open command in the existing Command Dock. |
| Local check-in streak | Isolated local browser | Passed | Opening local tools created a 1-day local streak and it remained 1 after refresh on the same date. It explicitly says it is not coding time; source behavior keeps the current-visit UI meaningful if browser storage fails. |
| Launchpad URLs | Local browser DOM | Passed for link targets | YouTube, Facebook, and Instagram point to their official HTTPS sites with new-tab security attributes. They were not opened during test. |
| Runtime console | Isolated local browser | Passed | Browser error and warning logs were empty after writing, themes, games, console, and streak checks. |
| Responsive layout | Local browser | Passed | Real 360px, 768px, 1280px, and 1440px viewport overrides were checked. An initial 768px dock overflow was fixed; the final pass had no horizontal document overflow at any tested width. |
| Deployed website | Fresh public GitHub Pages tab | Passed | The v4 CSS/JS assets loaded at the public URL. The visible Run button handled `status`, `open games`, and `theme paper`; Command Dock filtering plus Escape were checked; 360px, 768px, 1280px, and 1440px had no horizontal document overflow; browser error/warning logs were empty. A clean browser screenshot was captured but not uploaded. |
| Quiet landing / maximize / game tabs / voice language | Source + syntax checks | Source-checked | The v5 update starts with all app windows closed, adds maximize/restore state to layout v2, provides an accessible Signal Sprint / Desk Grid tab switcher, and lets a visitor choose Hindi or English speech recognition. Fresh browser interaction testing is pending before a runtime or deployed claim. |
| Focus List | Source + syntax checks | Source-checked | The v6 update adds a small, namespaced local next-step list with blank/duplicate/12-item guards, completion and remove controls, and an `open focus` console alias. Fresh browser interaction testing is pending before a runtime or deployed claim. |
| Recent Desk trail | Source + syntax checks | Source-checked | The v7 update keeps up to four recently opened Workbench tools in a namespaced local list and shows them only on the otherwise-clear landing screen. Fresh browser interaction testing is pending before a runtime or deployed claim. |
| Desk Modes | Source + syntax checks | Source-checked | The v8 update provides Explore, Focus, and Break recipes from both the landing page and the persistent top bar. A selected recipe restores only its useful windows, minimizes other open apps, keeps all data intact, and saves the resulting layout. Fresh browser interaction testing is pending before a runtime or deployed claim. |
| Open-window strip | Source + syntax checks | Source-checked | The v10 update adds a wider-screen top-bar list of currently open apps. Selecting a visible app focuses it; selecting a minimized app restores it. Keyboard focus on a window title updates the strip's active marker and saved front order. The compact layout intentionally uses the existing dock instead. Fresh browser interaction testing is pending before a runtime or deployed claim. |
| Visible-window cycling | Isolated local browser | Passed for Console and Command Dock paths | With three open windows, Console `next` moved focus to another visible Workbench window and the Command Dock search exposed Focus next open window. Browser error logs stayed empty. The physical `Alt` + `PageUp`/`PageDown` shortcut remains source-checked because the local test bridge does not provide a native keyboard chord. |
| Clear Desk | Source + syntax checks | Source-checked | The new Command Dock action and browser-only Console `home` / `clear desk` hide visible windows and return to landing without removing namespaced browser-local data. Fresh browser interaction testing is pending before a runtime or deployed claim. |

## Test boundaries

- The local browser used an isolated `127.0.0.1:4176` origin with synthetic writing/game test data. It did not touch the public demo's browser storage.
- No native wallpaper file was selected, no real voice transcription was accepted, and no personal content was used.
- No screenshot upload, Stardance devlog, project-info change, community outreach, tracker action, or Ship action is represented by this file.
