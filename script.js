import { projects } from "./projects.js";

const STORAGE_PREFIX = "aarav-workbench-os";
const LAYOUT_KEY = `${STORAGE_PREFIX}.layout.v2`;
const LEGACY_THEME_KEY = `${STORAGE_PREFIX}.theme.v1`;
const THEME_KEY = `${STORAGE_PREFIX}.theme.v2`;
const NOTEBOOK_KEY = `${STORAGE_PREFIX}.notebook.v1`;
const JOURNAL_KEY = `${STORAGE_PREFIX}.journal.v1`;
const PERFORMANCE_KEY = `${STORAGE_PREFIX}.performance.v1`;
const SIGNAL_SPRINT_KEY = `${STORAGE_PREFIX}.signal-sprint.v1`;
const DESK_GRID_KEY = `${STORAGE_PREFIX}.desk-grid.v1`;
const STREAK_KEY = `${STORAGE_PREFIX}.streak.v1`;
const FOCUS_LIST_KEY = `${STORAGE_PREFIX}.focus-list.v1`;
const RECENT_APPS_KEY = `${STORAGE_PREFIX}.recent-apps.v1`;
const LAYOUT_VERSION = 2;
const MOVE_STEP = 24;
const MAX_WALLPAPER_BYTES = 4 * 1024 * 1024;
const MAX_CONSOLE_LINES = 100;
const THEMES = {
  paper: "Paper",
  night: "Night",
  moss: "Moss",
  ember: "Ember",
};

const desktop = document.querySelector("#desktop");
const statusMessage = document.querySelector("#status-message");
const clock = document.querySelector("#clock");
const deskModePicker = document.querySelector("#desk-mode-picker");
const themeToggle = document.querySelector("#theme-toggle");
const commandDialog = document.querySelector("#command-dock");
const commandSearch = document.querySelector("#command-search");
const commandResults = document.querySelector("#command-results");
const projectSearch = document.querySelector("#project-search");
const projectList = document.querySelector("#project-list");
const projectCount = document.querySelector("#project-count");
const layoutSummary = document.querySelector("#layout-summary");
const notebookTitleInput = document.querySelector("#notebook-title-input");
const notebookBodyInput = document.querySelector("#notebook-body-input");
const notebookStatus = document.querySelector("#notebook-status");
const journalInput = document.querySelector("#journal-input");
const journalStatus = document.querySelector("#journal-status");
const voiceStatus = document.querySelector("#voice-status");
const startDictationButton = document.querySelector("#start-dictation");
const stopDictationButton = document.querySelector("#stop-dictation");
const speechLanguage = document.querySelector("#speech-language");
const clearDataDialog = document.querySelector("#clear-data-dialog");
const clearDataTitle = document.querySelector("#clear-data-title");
const clearDataDescription = document.querySelector("#clear-data-description");
const confirmClearDataButton = document.querySelector("#confirm-clear-data");
const cancelClearDataButton = document.querySelector("#cancel-clear-data");
const wallpaperInput = document.querySelector("#wallpaper-input");
const wallpaperStatus = document.querySelector("#wallpaper-status");
const resetWallpaperButton = document.querySelector("#reset-wallpaper");
const performanceModeToggle = document.querySelector("#performance-mode-toggle");
const performanceStatus = document.querySelector("#performance-status");
const signalStartButton = document.querySelector("#signal-start");
const signalPressButton = document.querySelector("#signal-press");
const signalStatus = document.querySelector("#signal-status");
const signalBest = document.querySelector("#signal-best");
const deskGrid = document.querySelector("#desk-grid");
const deskGridStatus = document.querySelector("#desk-grid-status");
const deskGridBest = document.querySelector("#desk-grid-best");
const deskGridNewButton = document.querySelector("#desk-grid-new");
const gameTabs = [...document.querySelectorAll("[data-game-tab]")];
const gamePanels = [...document.querySelectorAll("[data-game-panel]")];
const landingPanel = document.querySelector("#landing-panel");
const consoleForm = document.querySelector("#console-form");
const consoleInput = document.querySelector("#console-input");
const consoleOutput = document.querySelector("#console-output");
const consoleRunButton = document.querySelector("#console-run");
const consoleClearButton = document.querySelector("#console-clear");
const streakCount = document.querySelector("#streak-count");
const streakStatus = document.querySelector("#streak-status");
const focusListForm = document.querySelector("#focus-list-form");
const focusListInput = document.querySelector("#focus-list-input");
const focusListItems = document.querySelector("#focus-list-items");
const focusListStatus = document.querySelector("#focus-list-status");
const recentAppsElement = document.querySelector("#recent-apps");
const windowElements = [...document.querySelectorAll(".os-window")];
const windowsById = new Map(windowElements.map((windowElement) => [windowElement.dataset.windowId, windowElement]));
const deskModeButtons = [...document.querySelectorAll("[data-desk-mode]")];

let topZIndex = 10;
let activeWindowId = "welcome";
let activeCommandIndex = 0;
let previousFocusedElement = null;
let storageWarningShown = false;
let clearDataTarget = null;
let clearDataTrigger = null;
let speechRecognition = null;
let isDictating = false;
let customWallpaperUrl = null;
let signalSprintTimer = null;
let signalSprintState = "idle";
let signalReadyAt = null;
let deskGridState = {
  cards: [],
  firstIndex: null,
  locked: false,
  attempts: 0,
  matches: 0,
  mismatchTimer: null,
};
let currentStreak = { count: 0, lastCheckIn: null };
let focusList = [];
let recentApps = [];

const DESK_GRID_PAIRS = [
  { symbol: "▲", name: "triangle" },
  { symbol: "●", name: "circle" },
  { symbol: "◆", name: "diamond" },
  { symbol: "✦", name: "star" },
  { symbol: "☾", name: "moon" },
  { symbol: "✚", name: "cross" },
];

const DESK_MODES = {
  explore: ["projects", "notes"],
  focus: ["focus-list", "notebook"],
  break: ["games"],
};

function isMobileLayout() {
  return window.matchMedia("(max-width: 767px)").matches;
}

function announce(message) {
  statusMessage.textContent = "";
  window.requestAnimationFrame(() => {
    statusMessage.textContent = message;
  });
}

function friendlyTitle(windowElement) {
  return windowElement.querySelector(".window-title")?.textContent.trim() || "Window";
}

function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    if (!storageWarningShown) {
      storageWarningShown = true;
      announce("This browser cannot save the workspace right now. The desk will still work for this visit.");
    }
    return false;
  }
}

function safeRemove(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    if (!storageWarningShown) {
      storageWarningShown = true;
      announce("This browser cannot clear the saved workspace right now.");
    }
    return false;
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function asFiniteNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function defaultWindowState(windowElement) {
  return {
    x: Number(windowElement.dataset.defaultX) || 0,
    y: Number(windowElement.dataset.defaultY) || 0,
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    z: 1,
  };
}

function currentWindowState(windowElement) {
  return {
    x: asFiniteNumber(Number.parseFloat(windowElement.style.left), Number(windowElement.dataset.defaultX) || 0),
    y: asFiniteNumber(Number.parseFloat(windowElement.style.top), Number(windowElement.dataset.defaultY) || 0),
    isOpen: !windowElement.hidden,
    isMinimized: windowElement.dataset.minimized === "true",
    isMaximized: windowElement.dataset.maximized === "true",
    z: asFiniteNumber(Number.parseInt(windowElement.style.zIndex, 10), 1),
  };
}

function normalizeSavedWindowState(candidate, fallback) {
  if (!candidate || typeof candidate !== "object") {
    return fallback;
  }

  return {
    x: asFiniteNumber(candidate.x, fallback.x),
    y: asFiniteNumber(candidate.y, fallback.y),
    isOpen: typeof candidate.isOpen === "boolean" ? candidate.isOpen : fallback.isOpen,
    isMinimized: typeof candidate.isMinimized === "boolean" ? candidate.isMinimized : fallback.isMinimized,
    isMaximized: typeof candidate.isMaximized === "boolean" ? candidate.isMaximized : fallback.isMaximized,
    z: asFiniteNumber(candidate.z, fallback.z),
  };
}

function readSavedLayout() {
  const rawLayout = safeGet(LAYOUT_KEY);
  if (!rawLayout) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawLayout);
    if (parsed?.version !== LAYOUT_VERSION || !parsed.windows || typeof parsed.windows !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getClampedPosition(windowElement, x, y) {
  if (isMobileLayout()) {
    return { x, y };
  }

  const desktopBounds = desktop.getBoundingClientRect();
  const windowBounds = windowElement.getBoundingClientRect();
  const maxX = Math.max(0, desktopBounds.width - Math.min(windowBounds.width, desktopBounds.width));
  const maxY = Math.max(0, desktopBounds.height - Math.min(windowBounds.height, desktopBounds.height));

  return {
    x: Math.round(clamp(x, 0, maxX)),
    y: Math.round(clamp(y, 0, maxY)),
  };
}

function setWindowPosition(windowElement, x, y) {
  if (isMobileLayout()) {
    return;
  }

  const position = getClampedPosition(windowElement, x, y);
  windowElement.style.left = `${position.x}px`;
  windowElement.style.top = `${position.y}px`;
}

function updateDockItem(windowElement) {
  const dockItem = document.querySelector(`[data-open-window="${windowElement.dataset.windowId}"]`);
  if (!dockItem) {
    return;
  }

  const isOpen = !windowElement.hidden;
  const isMinimized = windowElement.dataset.minimized === "true";
  const state = !isOpen ? "closed" : isMinimized ? "minimized" : "open";
  dockItem.dataset.windowState = state;
  dockItem.setAttribute("aria-pressed", String(isOpen && !isMinimized));
  dockItem.setAttribute("aria-label", `${isOpen && !isMinimized ? "Focus" : "Open"} ${friendlyTitle(windowElement)} (${state})`);
}

function updateAllDockItems() {
  windowElements.forEach(updateDockItem);
}

function readRecentApps() {
  const rawRecentApps = safeGet(RECENT_APPS_KEY);
  if (!rawRecentApps) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawRecentApps);
    if (parsed?.version !== 1 || !Array.isArray(parsed.items)) {
      return [];
    }
    return parsed.items.filter((id) => typeof id === "string" && windowsById.has(id)).slice(0, 4);
  } catch {
    return [];
  }
}

function renderRecentApps() {
  recentAppsElement.replaceChildren();
  if (recentApps.length === 0) {
    const empty = document.createElement("p");
    empty.className = "recent-app-empty";
    empty.textContent = "Nothing opened yet. Pick a tool above or use the dock.";
    recentAppsElement.append(empty);
    return;
  }

  recentApps.forEach((windowId) => {
    const windowElement = windowsById.get(windowId);
    if (!windowElement) {
      return;
    }
    const button = document.createElement("button");
    button.className = "recent-app";
    button.type = "button";
    button.textContent = `Open ${friendlyTitle(windowElement)}`;
    button.addEventListener("click", () => restoreWindow(windowElement));
    recentAppsElement.append(button);
  });
}

function recordRecentApp(windowId) {
  recentApps = [windowId, ...recentApps.filter((id) => id !== windowId)].slice(0, 4);
  const saved = safeSet(RECENT_APPS_KEY, JSON.stringify({ version: 1, items: recentApps }));
  renderRecentApps();
  return saved;
}

function updateLayoutSummary() {
  const openWindows = windowElements.filter((windowElement) => !windowElement.hidden);
  const minimizedWindows = openWindows.filter((windowElement) => windowElement.dataset.minimized === "true");
  const visibleWindows = openWindows.length - minimizedWindows.length;
  layoutSummary.textContent = `${visibleWindows} visible, ${minimizedWindows.length} minimized. This layout is saved only in this browser.`;
  landingPanel.hidden = visibleWindows > 0;
}

function serializeLayout() {
  const windowState = Object.fromEntries(
    windowElements.map((windowElement) => [windowElement.dataset.windowId, currentWindowState(windowElement)]),
  );

  return JSON.stringify({
    version: LAYOUT_VERSION,
    savedAt: new Date().toISOString(),
    windows: windowState,
  });
}

function persistLayout({ announceSave = false } = {}) {
  const saved = safeSet(LAYOUT_KEY, serializeLayout());
  updateLayoutSummary();
  if (saved && announceSave) {
    announce("Workspace snapshot saved on this device.");
  }
}

function bringToFront(windowElement) {
  topZIndex += 1;
  windowElement.style.zIndex = String(topZIndex);
  activeWindowId = windowElement.dataset.windowId;
}

function focusWindow(windowElement, { shouldFocus = true, announceFocus = false } = {}) {
  if (windowElement.hidden) {
    windowElement.hidden = false;
  }
  windowElement.dataset.minimized = "false";
  bringToFront(windowElement);
  updateDockItem(windowElement);
  updateMaximizeControl(windowElement);
  updateLayoutSummary();

  if (shouldFocus) {
    windowElement.querySelector("[data-drag-handle]")?.focus({ preventScroll: true });
  }
  if (announceFocus) {
    announce(`${friendlyTitle(windowElement)} is open and focused.`);
  }
}

function minimizeWindow(windowElement) {
  if (windowElement.hidden) {
    return;
  }
  if (windowElement.dataset.windowId === "journal") {
    stopDictation();
  }
  if (windowElement.dataset.windowId === "games") {
    stopGames();
  }
  windowElement.dataset.minimized = "true";
  updateDockItem(windowElement);
  updateMaximizeControl(windowElement);
  persistLayout();
  document.querySelector(`[data-open-window="${windowElement.dataset.windowId}"]`)?.focus({ preventScroll: true });
  announce(`${friendlyTitle(windowElement)} minimized.`);
}

function closeWindow(windowElement) {
  if (windowElement.dataset.windowId === "journal") {
    stopDictation();
  }
  if (windowElement.dataset.windowId === "games") {
    stopGames();
  }
  windowElement.hidden = true;
  windowElement.dataset.minimized = "false";
  updateDockItem(windowElement);
  updateMaximizeControl(windowElement);
  persistLayout();
  document.querySelector(`[data-open-window="${windowElement.dataset.windowId}"]`)?.focus({ preventScroll: true });
  announce(`${friendlyTitle(windowElement)} closed. Use the dock to bring it back.`);
}

function restoreWindow(windowElement) {
  if (["notebook", "journal", "themes", "games", "console", "launchpad"].includes(windowElement.dataset.windowId)) {
    recordLocalCheckIn();
  }
  focusWindow(windowElement, { shouldFocus: true, announceFocus: true });
  recordRecentApp(windowElement.dataset.windowId);
  persistLayout();
}

function openDeskMode(mode) {
  const windowIds = DESK_MODES[mode];
  if (!windowIds) {
    return;
  }

  windowElements.forEach((windowElement) => {
    const isPartOfMode = windowIds.includes(windowElement.dataset.windowId);
    if (isPartOfMode) {
      windowElement.hidden = false;
      windowElement.dataset.minimized = "false";
      windowElement.dataset.maximized = "false";
      bringToFront(windowElement);
      recordRecentApp(windowElement.dataset.windowId);
    } else if (!windowElement.hidden) {
      if (windowElement.dataset.windowId === "journal") {
        stopDictation();
      }
      if (windowElement.dataset.windowId === "games") {
        stopGames();
      }
      windowElement.dataset.minimized = "true";
    }
    updateDockItem(windowElement);
    updateMaximizeControl(windowElement);
  });

  updateLayoutSummary();
  persistLayout();
  const firstWindow = windowsById.get(windowIds[0]);
  firstWindow?.querySelector("[data-drag-handle]")?.focus({ preventScroll: true });
  announce(`${mode[0].toUpperCase()}${mode.slice(1)} desk ready. Other open apps were minimized, not closed.`);
}

function updateMaximizeControl(windowElement) {
  const maximizeButton = windowElement.querySelector('[data-action="maximize"]');
  if (!maximizeButton) {
    return;
  }

  const maximized = windowElement.dataset.maximized === "true";
  const title = friendlyTitle(windowElement);
  maximizeButton.textContent = maximized ? "▣" : "□";
  maximizeButton.setAttribute("aria-label", `${maximized ? "Restore" : "Maximize"} ${title}`);
  maximizeButton.setAttribute("title", `${maximized ? "Restore" : "Maximize"} ${title}`);
  maximizeButton.setAttribute("aria-pressed", String(maximized));
}

function toggleMaximizeWindow(windowElement) {
  if (isMobileLayout()) {
    announce("Windows already use the full mobile width.");
    return;
  }

  if (windowElement.hidden) {
    windowElement.hidden = false;
    windowElement.dataset.minimized = "false";
  }

  const willMaximize = windowElement.dataset.maximized !== "true";
  windowElement.dataset.maximized = String(willMaximize);
  bringToFront(windowElement);
  updateDockItem(windowElement);
  updateMaximizeControl(windowElement);
  persistLayout();
  announce(`${friendlyTitle(windowElement)} ${willMaximize ? "maximized" : "restored"}.`);
}

function applyLayout() {
  const savedLayout = readSavedLayout();
  let highestSavedZ = 1;

  windowElements.forEach((windowElement, index) => {
    const fallback = { ...defaultWindowState(windowElement), z: index + 1 };
    const saved = normalizeSavedWindowState(savedLayout?.windows?.[windowElement.dataset.windowId], fallback);

    windowElement.hidden = !saved.isOpen;
    windowElement.dataset.minimized = String(saved.isMinimized && saved.isOpen);
    windowElement.dataset.maximized = String(saved.isMaximized && saved.isOpen && !saved.isMinimized);
    windowElement.style.zIndex = String(saved.z);
    setWindowPosition(windowElement, saved.x, saved.y);
    highestSavedZ = Math.max(highestSavedZ, saved.z);
  });

  topZIndex = highestSavedZ;
  updateAllDockItems();
  windowElements.forEach(updateMaximizeControl);
  updateLayoutSummary();
}

function resetLayout() {
  const layoutRemoved = safeRemove(LAYOUT_KEY);

  windowElements.forEach((windowElement, index) => {
    const fallback = defaultWindowState(windowElement);
    windowElement.hidden = !fallback.isOpen;
    windowElement.dataset.minimized = String(fallback.isMinimized);
    windowElement.dataset.maximized = String(fallback.isMaximized);
    windowElement.style.zIndex = String(index + 1);
    setWindowPosition(windowElement, fallback.x, fallback.y);
  });

  topZIndex = windowElements.length + 1;
  updateAllDockItems();
  windowElements.forEach(updateMaximizeControl);
  updateLayoutSummary();
  announce(layoutRemoved
    ? "Default workspace layout restored. Your theme was kept."
    : "Default layout is shown for this visit, but the saved layout could not be cleared.");
}

function normalizeTheme(theme) {
  return Object.hasOwn(THEMES, theme) ? theme : "paper";
}

function updateThemeControls(theme) {
  const label = THEMES[theme];
  themeToggle.textContent = `Theme: ${label}`;
  themeToggle.setAttribute("aria-label", `Cycle workspace theme. Current theme: ${label}`);
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
  });
}

function setTheme(theme, { announceTheme = false, persist = true } = {}) {
  const nextTheme = normalizeTheme(theme);
  document.body.dataset.theme = nextTheme;
  updateThemeControls(nextTheme);

  if (persist) {
    safeSet(THEME_KEY, nextTheme);
  }

  if (announceTheme) {
    announce(`${THEMES[nextTheme]} theme enabled.`);
  }
}

function readSavedTheme() {
  const savedTheme = safeGet(THEME_KEY);
  if (Object.hasOwn(THEMES, savedTheme)) {
    return savedTheme;
  }

  const legacyTheme = safeGet(LEGACY_THEME_KEY);
  if (legacyTheme === "paper" || legacyTheme === "night") {
    safeSet(THEME_KEY, legacyTheme);
    return legacyTheme;
  }

  return "paper";
}

function initializeTheme() {
  setTheme(readSavedTheme(), { persist: false });
}

function cycleTheme() {
  const themeNames = Object.keys(THEMES);
  const currentIndex = themeNames.indexOf(document.body.dataset.theme);
  const nextTheme = themeNames[(currentIndex + 1) % themeNames.length];
  setTheme(nextTheme, { announceTheme: true });
}

function setPerformanceMode(enabled, { announceMode = false } = {}) {
  const nextValue = Boolean(enabled);
  document.body.dataset.performanceMode = String(nextValue);
  performanceModeToggle.setAttribute("aria-pressed", String(nextValue));
  performanceModeToggle.textContent = nextValue ? "Use normal motion" : "Use quieter motion";
  performanceStatus.textContent = nextValue
    ? "Quieter motion is active for this WebOS only; it does not optimize your computer."
    : "Quieter motion is off. This setting affects this WebOS only; it does not optimize your computer.";
  safeSet(PERFORMANCE_KEY, JSON.stringify({ version: 1, reducedMotion: nextValue }));

  if (announceMode) {
    announce(nextValue ? "Quieter motion enabled for this WebOS." : "Normal Workbench motion restored.");
  }
}

function initializePerformanceMode() {
  const rawPerformance = safeGet(PERFORMANCE_KEY);
  if (!rawPerformance) {
    setPerformanceMode(false);
    return;
  }

  try {
    const savedPerformance = JSON.parse(rawPerformance);
    setPerformanceMode(savedPerformance?.version === 1 && savedPerformance.reducedMotion === true);
  } catch {
    setPerformanceMode(false);
  }
}

function removeCustomWallpaper({ announceRemoval = false } = {}) {
  if (customWallpaperUrl) {
    URL.revokeObjectURL(customWallpaperUrl);
    customWallpaperUrl = null;
  }

  desktop.dataset.wallpaper = "default";
  desktop.style.removeProperty("--custom-wallpaper");
  wallpaperInput.value = "";
  resetWallpaperButton.disabled = true;
  wallpaperStatus.textContent = "Built-in themes are saved. A chosen image lasts only for this open tab and is never uploaded.";

  if (announceRemoval) {
    announce("Temporary wallpaper removed. Your saved theme was kept.");
  }
}

function setTemporaryWallpaper(file) {
  const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
  const existingWallpaperNotice = customWallpaperUrl
    ? " Your current temporary wallpaper is still active."
    : " No wallpaper was applied.";
  if (!file) {
    return;
  }

  if (!allowedTypes.has(file.type)) {
    wallpaperInput.value = "";
    wallpaperStatus.textContent = `Choose a PNG, JPEG, or WebP image.${existingWallpaperNotice}`;
    return;
  }

  if (file.size > MAX_WALLPAPER_BYTES) {
    wallpaperInput.value = "";
    wallpaperStatus.textContent = `Choose an image smaller than 4 MB.${existingWallpaperNotice}`;
    return;
  }

  if (customWallpaperUrl) {
    URL.revokeObjectURL(customWallpaperUrl);
  }
  customWallpaperUrl = URL.createObjectURL(file);
  desktop.style.setProperty("--custom-wallpaper", `url("${customWallpaperUrl}")`);
  desktop.dataset.wallpaper = "custom";
  resetWallpaperButton.disabled = false;
  wallpaperStatus.textContent = "Temporary wallpaper active for this tab only. It was not uploaded or saved.";
  announce("Temporary wallpaper applied for this tab only.");
}

function readGameBest(key, propertyName) {
  const rawScore = safeGet(key);
  if (!rawScore) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawScore);
    const value = parsed?.version === 1 ? parsed[propertyName] : null;
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function updateSignalBest() {
  const bestMs = readGameBest(SIGNAL_SPRINT_KEY, "bestMs");
  signalBest.textContent = bestMs ? `Best: ${bestMs} ms` : "Best: —";
}

function updateDeskGridBest() {
  const bestAttempts = readGameBest(DESK_GRID_KEY, "bestAttempts");
  deskGridBest.textContent = bestAttempts ? `Best: ${bestAttempts} turns` : "Best: —";
}

function finishSignalSprint(message) {
  if (signalSprintTimer) {
    window.clearTimeout(signalSprintTimer);
    signalSprintTimer = null;
  }

  signalSprintState = "idle";
  signalReadyAt = null;
  signalStartButton.textContent = "Start signal run";
  signalPressButton.disabled = true;
  signalStatus.textContent = message;
}

function startSignalSprint() {
  finishSignalSprint("Signal run starting. Wait for the next message.");
  signalSprintState = "waiting";
  signalStartButton.textContent = "Restart signal run";
  signalPressButton.disabled = false;
  signalStatus.textContent = "Waiting for the signal. Pressing early ends this run.";

  const waitMs = 1200 + Math.floor(Math.random() * 2001);
  signalSprintTimer = window.setTimeout(() => {
    signalSprintTimer = null;
    signalSprintState = "ready";
    signalReadyAt = performance.now();
    signalStatus.textContent = "Signal live — press now.";
    signalPressButton.focus({ preventScroll: true });
  }, waitMs);
}

function pressSignalSprint() {
  if (signalSprintState === "waiting") {
    finishSignalSprint("Too early. Start another run when you are ready.");
    return;
  }

  if (signalSprintState !== "ready" || signalReadyAt === null) {
    return;
  }

  const reactionMs = Math.max(1, Math.round(performance.now() - signalReadyAt));
  const previousBest = readGameBest(SIGNAL_SPRINT_KEY, "bestMs");
  const isNewBest = !previousBest || reactionMs < previousBest;
  let bestWasSaved = false;
  if (isNewBest) {
    bestWasSaved = safeSet(SIGNAL_SPRINT_KEY, JSON.stringify({ version: 1, bestMs: reactionMs }));
    if (bestWasSaved) {
      updateSignalBest();
    }
  }

  const resultMessage = isNewBest
    ? bestWasSaved
      ? "That is your local best."
      : "This was a strong run, but this browser could not save a local best."
    : "Your saved best is still shown above.";
  finishSignalSprint(`${reactionMs} ms. ${resultMessage}`);
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function nextAvailableDeskGridIndex(startIndex = 0) {
  const afterStart = deskGridState.cards.findIndex((card, index) => index >= startIndex && !card.matched);
  return afterStart >= 0 ? afterStart : deskGridState.cards.findIndex((card) => !card.matched);
}

function renderDeskGrid({ focusIndex = null } = {}) {
  deskGrid.replaceChildren();

  deskGridState.cards.forEach((card, index) => {
    const isRevealed = card.revealed || card.matched;
    const cardButton = document.createElement("button");
    cardButton.type = "button";
    cardButton.className = "desk-grid-card";
    cardButton.dataset.revealed = String(isRevealed);
    cardButton.dataset.matched = String(card.matched);
    cardButton.dataset.deskIndex = String(index);
    cardButton.disabled = deskGridState.locked || card.matched;
    cardButton.textContent = isRevealed ? card.symbol : "?";
    cardButton.setAttribute(
      "aria-label",
      isRevealed
        ? `${card.name}${card.matched ? ", matched" : ", revealed"}`
        : `Hidden Desk Grid tile ${index + 1}`,
    );
    cardButton.addEventListener("click", () => chooseDeskGridCard(index));
    deskGrid.append(cardButton);
  });

  if (Number.isInteger(focusIndex)) {
    const nextFocus = deskGrid.querySelector(`[data-desk-index="${focusIndex}"]:not(:disabled)`);
    nextFocus?.focus({ preventScroll: true });
  }
}

function createDeskGrid() {
  if (deskGridState.mismatchTimer) {
    window.clearTimeout(deskGridState.mismatchTimer);
  }

  deskGridState = {
    cards: shuffle(DESK_GRID_PAIRS.flatMap((pair, pairIndex) => [
      { ...pair, id: `${pairIndex}-a`, revealed: false, matched: false },
      { ...pair, id: `${pairIndex}-b`, revealed: false, matched: false },
    ])),
    firstIndex: null,
    locked: false,
    attempts: 0,
    matches: 0,
    mismatchTimer: null,
  };

  deskGridStatus.textContent = "New board ready. Match the six pairs in as few turns as you can.";
  renderDeskGrid();
}

function finishDeskGrid() {
  const previousBest = readGameBest(DESK_GRID_KEY, "bestAttempts");
  const isNewBest = !previousBest || deskGridState.attempts < previousBest;
  let bestWasSaved = false;
  if (isNewBest) {
    bestWasSaved = safeSet(DESK_GRID_KEY, JSON.stringify({ version: 1, bestAttempts: deskGridState.attempts }));
    if (bestWasSaved) {
      updateDeskGridBest();
    }
  }

  const completionMessage = isNewBest
    ? bestWasSaved
      ? "That is your local best."
      : "This browser could not save a local best."
    : "Try a new board to improve your local best.";
  deskGridStatus.textContent = `Board complete in ${deskGridState.attempts} turns. ${completionMessage}`;
}

function hideDeskGridMismatch(firstIndex, secondIndex) {
  deskGridState.cards[firstIndex].revealed = false;
  deskGridState.cards[secondIndex].revealed = false;
  deskGridState.firstIndex = null;
  deskGridState.locked = false;
  deskGridState.mismatchTimer = null;
  deskGridStatus.textContent = `Not a pair. ${deskGridState.attempts} turn${deskGridState.attempts === 1 ? "" : "s"} so far.`;
  renderDeskGrid({ focusIndex: firstIndex });
}

function chooseDeskGridCard(index) {
  const card = deskGridState.cards[index];
  if (!card || deskGridState.locked || card.revealed || card.matched) {
    return;
  }

  card.revealed = true;
  if (deskGridState.firstIndex === null) {
    deskGridState.firstIndex = index;
    deskGridStatus.textContent = "Pick one more tile to check the pair.";
    renderDeskGrid({ focusIndex: index });
    return;
  }

  const firstIndex = deskGridState.firstIndex;
  const firstCard = deskGridState.cards[firstIndex];
  deskGridState.attempts += 1;

  if (firstCard.name === card.name) {
    firstCard.matched = true;
    card.matched = true;
    deskGridState.firstIndex = null;
    deskGridState.matches += 1;
    if (deskGridState.matches === DESK_GRID_PAIRS.length) {
      renderDeskGrid();
      finishDeskGrid();
      deskGridNewButton.focus({ preventScroll: true });
      return;
    }

    deskGridStatus.textContent = `Pair found. ${DESK_GRID_PAIRS.length - deskGridState.matches} pair${DESK_GRID_PAIRS.length - deskGridState.matches === 1 ? "" : "s"} left.`;
    renderDeskGrid({ focusIndex: nextAvailableDeskGridIndex(index + 1) });
    return;
  }

  deskGridState.locked = true;
  deskGridStatus.textContent = "Not a pair. Turning both tiles back over.";
  renderDeskGrid();
  deskGridState.mismatchTimer = window.setTimeout(() => hideDeskGridMismatch(firstIndex, index), 650);
}

function stopDeskGridTransition() {
  if (deskGridState.mismatchTimer) {
    window.clearTimeout(deskGridState.mismatchTimer);
  }

  const hadOpenPair = deskGridState.firstIndex !== null || deskGridState.locked;
  deskGridState.cards.forEach((card) => {
    if (!card.matched) {
      card.revealed = false;
    }
  });
  deskGridState.firstIndex = null;
  deskGridState.locked = false;
  deskGridState.mismatchTimer = null;
  if (hadOpenPair) {
    deskGridStatus.textContent = "The unfinished turn was reset when Game Room was hidden.";
  }
  renderDeskGrid();
}

function stopGames() {
  const signalWasRunning = signalSprintState !== "idle";
  if (signalSprintTimer) {
    window.clearTimeout(signalSprintTimer);
    signalSprintTimer = null;
  }
  if (signalWasRunning) {
    signalSprintState = "idle";
    signalReadyAt = null;
    signalStartButton.textContent = "Start signal run";
    signalPressButton.disabled = true;
    signalStatus.textContent = "The unfinished signal run stopped when Game Room was hidden.";
  }
  stopDeskGridTransition();
}

function initializeGames() {
  updateSignalBest();
  updateDeskGridBest();
  createDeskGrid();
  setActiveGamePanel("signal");
}

function setActiveGamePanel(gameId, { focusTab = false } = {}) {
  const selectedId = gamePanels.some((panel) => panel.dataset.gamePanel === gameId) ? gameId : "signal";

  gameTabs.forEach((tab) => {
    const selected = tab.dataset.gameTab === selectedId;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focusTab) {
      tab.focus({ preventScroll: true });
    }
  });

  gamePanels.forEach((panel) => {
    panel.hidden = panel.dataset.gamePanel !== selectedId;
  });
}

function localDateKey(date = new Date()) {
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 10);
}

function dateDistanceInDays(previousDateKey, currentDateKey) {
  const previous = Date.parse(`${previousDateKey}T00:00:00Z`);
  const current = Date.parse(`${currentDateKey}T00:00:00Z`);
  if (Number.isNaN(previous) || Number.isNaN(current)) {
    return null;
  }
  return Math.round((current - previous) / 86_400_000);
}

function isValidLocalDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function readSavedStreak() {
  const rawStreak = safeGet(STREAK_KEY);
  if (!rawStreak) {
    return { count: 0, lastCheckIn: null };
  }

  try {
    const parsed = JSON.parse(rawStreak);
    const count = Number.isInteger(parsed?.count) && parsed.count > 0 ? parsed.count : 0;
    const lastCheckIn = isValidLocalDateKey(parsed?.lastCheckIn) ? parsed.lastCheckIn : null;
    return count && lastCheckIn ? { count, lastCheckIn } : { count: 0, lastCheckIn: null };
  } catch {
    return { count: 0, lastCheckIn: null };
  }
}

function updateStreakUI(streak = currentStreak, { isSaved = true } = {}) {
  streakCount.textContent = `${streak.count} day${streak.count === 1 ? "" : "s"}`;
  streakStatus.textContent = streak.count
    ? `${streak.count}-day local check-in streak. It records local Workbench use only, not coding time.${isSaved ? "" : " This browser could not save it after refresh."}`
    : "Open a local Workbench tool to begin a local check-in streak.";
}

function recordLocalCheckIn() {
  const today = localDateKey();
  const previous = currentStreak;
  const daysSincePrevious = previous.lastCheckIn ? dateDistanceInDays(previous.lastCheckIn, today) : null;
  let nextCount = previous.count;

  if (previous.lastCheckIn === today) {
    updateStreakUI(previous);
    return;
  }

  if (daysSincePrevious === 1) {
    nextCount += 1;
  } else {
    nextCount = 1;
  }

  const nextStreak = { version: 1, count: nextCount, lastCheckIn: today };
  const saved = safeSet(STREAK_KEY, JSON.stringify(nextStreak));
  currentStreak = nextStreak;
  updateStreakUI(nextStreak, { isSaved: saved });
}

function initializeLocalActivity() {
  currentStreak = readSavedStreak();
  updateStreakUI(currentStreak);
}

function normalizeFocusItem(candidate) {
  if (!candidate || typeof candidate !== "object" || typeof candidate.id !== "string") {
    return null;
  }

  const text = asString(candidate.text).trim().slice(0, focusListInput.maxLength);
  if (!text) {
    return null;
  }

  return { id: candidate.id, text, done: Boolean(candidate.done) };
}

function readFocusList() {
  const rawList = safeGet(FOCUS_LIST_KEY);
  if (!rawList) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawList);
    if (parsed?.version !== 1 || !Array.isArray(parsed.items)) {
      return [];
    }
    return parsed.items.map(normalizeFocusItem).filter(Boolean).slice(0, 12);
  } catch {
    return [];
  }
}

function persistFocusList() {
  return safeSet(FOCUS_LIST_KEY, JSON.stringify({ version: 1, items: focusList }));
}

function updateFocusListStatus(message) {
  const remaining = focusList.filter((item) => !item.done).length;
  focusListStatus.textContent = message || (focusList.length === 0
    ? "No next steps yet."
    : `${remaining} open ${remaining === 1 ? "step" : "steps"} saved in this browser.`);
}

function renderFocusList() {
  focusListItems.replaceChildren();

  focusList.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.className = "focus-list-item";
    listItem.dataset.done = String(item.done);

    const doneToggle = document.createElement("input");
    doneToggle.type = "checkbox";
    doneToggle.checked = item.done;
    doneToggle.setAttribute("aria-label", `Mark ${item.text} ${item.done ? "not done" : "done"}`);
    doneToggle.addEventListener("change", () => {
      focusList = focusList.map((entry) => entry.id === item.id ? { ...entry, done: doneToggle.checked } : entry);
      const saved = persistFocusList();
      renderFocusList();
      updateFocusListStatus(saved ? "Focus List updated in this browser." : "This browser could not save that change.");
    });

    const text = document.createElement("span");
    text.textContent = item.text;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", `Remove ${item.text}`);
    removeButton.addEventListener("click", () => {
      focusList = focusList.filter((entry) => entry.id !== item.id);
      const saved = persistFocusList();
      renderFocusList();
      updateFocusListStatus(saved ? "Step removed from this browser." : "This browser could not remove that step.");
    });

    listItem.append(doneToggle, text, removeButton);
    focusListItems.append(listItem);
  });

  updateFocusListStatus();
}

function addFocusListItem(event) {
  event.preventDefault();
  const text = focusListInput.value.trim().replace(/\s+/g, " ").slice(0, focusListInput.maxLength);
  if (!text) {
    updateFocusListStatus("Write a short next step before adding it.");
    focusListInput.focus();
    return;
  }
  if (focusList.some((item) => item.text.toLocaleLowerCase() === text.toLocaleLowerCase())) {
    updateFocusListStatus("That step is already on this Focus List.");
    focusListInput.focus();
    return;
  }
  if (focusList.length >= 12) {
    updateFocusListStatus("Keep this list small: remove a step before adding another.");
    return;
  }

  focusList = [{ id: crypto.randomUUID(), text, done: false }, ...focusList];
  const saved = persistFocusList();
  focusListInput.value = "";
  renderFocusList();
  updateFocusListStatus(saved ? "Next step saved in this browser." : "This browser could not save that step.");
}

function initializeFocusList() {
  focusList = readFocusList();
  renderFocusList();
}

function initializeRecentApps() {
  recentApps = readRecentApps();
  renderRecentApps();
}

function appendConsoleLine(text, className = "") {
  const line = document.createElement("p");
  line.textContent = text;
  if (className) {
    line.className = className;
  }
  consoleOutput.append(line);
  while (consoleOutput.children.length > MAX_CONSOLE_LINES) {
    consoleOutput.firstElementChild?.remove();
  }
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function clearConsoleOutput() {
  consoleOutput.replaceChildren();
  appendConsoleLine("Type help to see the small set of browser-only commands.");
  announce("Workbench Console output cleared.");
}

function runBrowserOnlyCommand(rawCommand) {
  const command = rawCommand.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  if (!command) {
    appendConsoleLine("Enter a browser-only command, or type help.", "console-error");
    return;
  }

  appendConsoleLine(`> ${rawCommand.trim()}`, "console-input-line");

  const openWindow = (windowId) => {
    const windowElement = windowsById.get(windowId);
    if (!windowElement) {
      appendConsoleLine("That Workbench window is not available.", "console-error");
      return;
    }
    restoreWindow(windowElement);
    appendConsoleLine(`${friendlyTitle(windowElement)} opened in this browser.`);
  };

  if (command === "help") {
    appendConsoleLine("Commands: help, open focus, open notebook, open games, open journal, open themes, open projects, open snapshot, open launchpad, theme paper|night|moss|ember, status, clear.");
    return;
  }

  if (command === "clear") {
    clearConsoleOutput();
    return;
  }

  if (command.startsWith("open ")) {
    const names = {
      notebook: "notebook",
      games: "games",
      journal: "journal",
      themes: "themes",
      projects: "projects",
      snapshot: "snapshot",
      launchpad: "launchpad",
      console: "console",
      focus: "focus-list",
    };
    if (Object.hasOwn(names, command.slice(5))) {
      openWindow(names[command.slice(5)]);
      return;
    }
  }

  if (command.startsWith("theme ")) {
    const requestedTheme = command.slice(6);
    if (Object.hasOwn(THEMES, requestedTheme)) {
      setTheme(requestedTheme, { announceTheme: true });
      appendConsoleLine(`${THEMES[requestedTheme]} theme saved in this browser.`);
      return;
    }
  }

  if (command === "status") {
    const visibleWindows = windowElements.filter((windowElement) => !windowElement.hidden && windowElement.dataset.minimized !== "true").length;
    const theme = THEMES[normalizeTheme(document.body.dataset.theme)];
    const motion = document.body.dataset.performanceMode === "true" ? "quieter" : "normal";
    appendConsoleLine(`${visibleWindows} windows visible. Theme: ${theme}. Motion: ${motion}. Saved browser data stays scoped to Aarav Workbench OS.`);
    return;
  }

  appendConsoleLine("That is not a Workbench command. Type help for the supported browser-only commands.", "console-error");
}

function executeConsoleInput() {
  runBrowserOnlyCommand(consoleInput.value.slice(0, consoleInput.maxLength));
  consoleInput.value = "";
  consoleInput.focus();
}

function updateClock() {
  const now = new Date();
  clock.dateTime = now.toISOString();
  clock.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function formatLocalSaveTime(value) {
  const savedAt = new Date(value);
  if (Number.isNaN(savedAt.getTime())) {
    return "Saved locally in this browser.";
  }

  return `Saved locally at ${new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(savedAt)}.`;
}

function readWritingDraft(key, fields) {
  const rawDraft = safeGet(key);
  if (!rawDraft) {
    return { ...fields, updatedAt: null };
  }

  try {
    const parsed = JSON.parse(rawDraft);
    if (parsed?.version !== 1 || typeof parsed !== "object") {
      return { ...fields, updatedAt: null };
    }

    return {
      ...Object.fromEntries(Object.keys(fields).map((field) => [field, asString(parsed[field], fields[field])])),
      updatedAt: typeof parsed.updatedAt === "string" && !Number.isNaN(Date.parse(parsed.updatedAt)) ? parsed.updatedAt : null,
    };
  } catch {
    return { ...fields, updatedAt: null };
  }
}

function updateWritingStatus(statusElement, hasText, updatedAt, emptyMessage) {
  statusElement.textContent = hasText && updatedAt ? formatLocalSaveTime(updatedAt) : emptyMessage;
}

function saveNotebook() {
  const title = notebookTitleInput.value.slice(0, notebookTitleInput.maxLength);
  const body = notebookBodyInput.value.slice(0, notebookBodyInput.maxLength);
  const hasText = Boolean(title.trim() || body.trim());

  if (!hasText) {
    const removed = safeRemove(NOTEBOOK_KEY);
    updateWritingStatus(
      notebookStatus,
      false,
      null,
      removed ? "Nothing has been written yet." : "This browser cannot clear the empty notebook draft right now.",
    );
    return;
  }

  const updatedAt = new Date().toISOString();
  const saved = safeSet(NOTEBOOK_KEY, JSON.stringify({ version: 1, title, body, updatedAt }));
  updateWritingStatus(notebookStatus, saved && hasText, updatedAt, "This browser cannot save the notebook right now.");
}

function saveJournal() {
  const body = journalInput.value.slice(0, journalInput.maxLength);
  const hasText = Boolean(body.trim());

  if (!hasText) {
    const removed = safeRemove(JOURNAL_KEY);
    updateWritingStatus(
      journalStatus,
      false,
      null,
      removed ? "Nothing has been written yet." : "This browser cannot clear the empty journal draft right now.",
    );
    return;
  }

  const updatedAt = new Date().toISOString();
  const saved = safeSet(JOURNAL_KEY, JSON.stringify({ version: 1, body, updatedAt }));
  updateWritingStatus(journalStatus, saved && hasText, updatedAt, "This browser cannot save the journal right now.");
}

function initializeWritingTools() {
  const notebook = readWritingDraft(NOTEBOOK_KEY, { title: "", body: "" });
  notebookTitleInput.value = notebook.title;
  notebookBodyInput.value = notebook.body;
  updateWritingStatus(notebookStatus, Boolean(notebook.title.trim() || notebook.body.trim()), notebook.updatedAt, "Nothing has been written yet.");

  const journal = readWritingDraft(JOURNAL_KEY, { body: "" });
  journalInput.value = journal.body;
  updateWritingStatus(journalStatus, Boolean(journal.body.trim()), journal.updatedAt, "Nothing has been written yet.");
}

function openClearDataDialog(target, trigger) {
  clearDataTarget = target;
  clearDataTrigger = trigger instanceof HTMLElement ? trigger : null;

  if (target === "notebook") {
    clearDataTitle.textContent = "Clear this notebook?";
    clearDataDescription.textContent = "This removes only this saved Workbench notebook from this browser.";
  } else {
    clearDataTitle.textContent = "Clear this story journal?";
    clearDataDescription.textContent = "This removes only this saved Workbench journal from this browser.";
  }

  clearDataDialog.showModal();
  cancelClearDataButton.focus();
}

function closeClearDataDialog() {
  if (clearDataDialog.open) {
    clearDataDialog.close();
  }
}

function clearSelectedWriting() {
  if (clearDataTarget === "notebook") {
    if (safeRemove(NOTEBOOK_KEY)) {
      notebookTitleInput.value = "";
      notebookBodyInput.value = "";
      updateWritingStatus(notebookStatus, false, null, "Notebook cleared from this browser.");
      announce("Notebook cleared from this browser.");
    } else {
      notebookStatus.textContent = "Notebook could not be cleared because this browser cannot update saved data.";
      announce("Notebook could not be cleared. Your text was kept in the editor.");
    }
  }

  if (clearDataTarget === "journal") {
    if (safeRemove(JOURNAL_KEY)) {
      journalInput.value = "";
      updateWritingStatus(journalStatus, false, null, "Journal cleared from this browser.");
      announce("Story journal cleared from this browser.");
    } else {
      journalStatus.textContent = "Journal could not be cleared because this browser cannot update saved data.";
      announce("Story journal could not be cleared. Your text was kept in the editor.");
    }
  }

  closeClearDataDialog();
}

function setDictationState(nextState, message) {
  isDictating = nextState;
  startDictationButton.disabled = nextState;
  stopDictationButton.disabled = !nextState;
  voiceStatus.textContent = message;
}

function appendDictation(text) {
  const cleanedText = text.trim();
  if (!cleanedText) {
    return;
  }

  const needsSpace = journalInput.value && !/\s$/.test(journalInput.value);
  journalInput.value = `${journalInput.value}${needsSpace ? " " : ""}${cleanedText}`.slice(0, journalInput.maxLength);
  saveJournal();
}

function configureSpeechRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    return null;
  }

  const recognition = new Recognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = speechLanguage.value || navigator.language || "en-IN";

  recognition.addEventListener("result", (event) => {
    let transcript = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      if (event.results[index].isFinal) {
        transcript += event.results[index][0].transcript;
      }
    }
    appendDictation(transcript);
    if (transcript.trim()) {
      voiceStatus.textContent = "Added the latest spoken words to the local journal draft.";
    }
  });

  recognition.addEventListener("error", (event) => {
    const messages = {
      "not-allowed": "Microphone permission was not granted. You can keep typing instead.",
      "service-not-allowed": "Voice input is not available in this browser. You can keep typing instead.",
      "no-speech": "No speech was heard. Try again or keep typing instead.",
      "audio-capture": "No microphone was available. You can keep typing instead.",
    };
    setDictationState(false, messages[event.error] || "Voice input stopped. You can keep typing instead.");
  });

  recognition.addEventListener("end", () => {
    if (isDictating) {
      setDictationState(false, "Voice input ended. Your local journal is still available to edit.");
    }
  });

  return recognition;
}

function startDictation() {
  if (!speechRecognition) {
    speechRecognition = configureSpeechRecognition();
  }

  if (!speechRecognition) {
    voiceStatus.textContent = "Voice input is not supported here. You can keep typing instead.";
    return;
  }

  try {
    setDictationState(true, `Listening in ${speechLanguage.options[speechLanguage.selectedIndex].text}… spoken words will be added to this local draft.`);
    speechRecognition.start();
  } catch {
    setDictationState(false, "Voice input could not start. You can keep typing instead.");
  }
}

function stopDictation() {
  if (speechRecognition && isDictating) {
    speechRecognition.stop();
  }
  setDictationState(false, "Voice input stopped. You can keep typing instead.");
}

function renderProjects(query = "") {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleProjects = projects.filter((project) => {
    const searchable = `${project.title} ${project.category} ${project.description}`.toLocaleLowerCase();
    return searchable.includes(normalizedQuery);
  });

  projectList.replaceChildren();
  projectCount.textContent = `${visibleProjects.length} / ${projects.length}`;

  if (visibleProjects.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-search";
    emptyState.textContent = "No project matches that search. Try a broader word.";
    projectList.append(emptyState);
    return;
  }

  visibleProjects.forEach((project) => {
    const card = document.createElement("article");
    card.className = "project-card";

    const title = document.createElement("h3");
    title.textContent = project.title;
    const description = document.createElement("p");
    description.textContent = project.description;
    const meta = document.createElement("div");
    meta.className = "project-meta";
    const tag = document.createElement("span");
    tag.className = "project-tag";
    tag.textContent = project.category;
    const links = document.createElement("div");
    links.className = "project-links";

    [
      [project.sourceUrl, "Source"],
      [project.demoUrl, "Demo"],
    ].filter(([url]) => Boolean(url)).forEach(([url, label]) => {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = label;
      links.append(link);
    });

    meta.append(tag, links);
    card.append(title, description, meta);
    projectList.append(card);
  });
}

function commandDefinitions() {
  const windowCommands = windowElements.map((windowElement) => ({
    id: `open-${windowElement.dataset.windowId}`,
    label: `Open ${friendlyTitle(windowElement)}`,
    detail: "Bring this window to the front",
    run: () => restoreWindow(windowElement),
  }));

  return [
    ...windowCommands,
    {
      id: "save-workspace",
      label: "Save workspace snapshot",
      detail: "Remember the open windows and positions",
      run: () => persistLayout({ announceSave: true }),
    },
    {
      id: "reset-layout",
      label: "Reset desktop layout",
      detail: "Return windows to their default positions",
      run: resetLayout,
    },
    {
      id: "cycle-theme",
      label: "Cycle workspace theme",
      detail: "Switch between Paper, Night, Moss, and Ember",
      run: cycleTheme,
    },
    ...Object.entries(THEMES).map(([theme, label]) => ({
      id: `use-${theme}-theme`,
      label: `Use ${label} theme`,
      detail: "Save this color preference in this browser",
      run: () => setTheme(theme, { announceTheme: true }),
    })),
  ];
}

function getFilteredCommands() {
  const searchTerm = commandSearch.value.trim().toLocaleLowerCase();
  return commandDefinitions().filter((command) => `${command.label} ${command.detail}`.toLocaleLowerCase().includes(searchTerm));
}

function renderCommandResults() {
  const commands = getFilteredCommands();
  activeCommandIndex = clamp(activeCommandIndex, 0, Math.max(commands.length - 1, 0));
  commandResults.replaceChildren();

  if (commands.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-search";
    emptyState.textContent = "No command matches that search.";
    commandResults.append(emptyState);
    return commands;
  }

  commands.forEach((command, index) => {
    const commandButton = document.createElement("button");
    commandButton.type = "button";
    commandButton.className = "command-result";
    commandButton.dataset.commandId = command.id;
    commandButton.dataset.active = String(index === activeCommandIndex);
    commandButton.setAttribute("role", "option");
    commandButton.setAttribute("aria-selected", String(index === activeCommandIndex));

    const label = document.createElement("span");
    label.textContent = command.label;
    const detail = document.createElement("small");
    detail.textContent = command.detail;
    commandButton.append(label, detail);
    commandButton.addEventListener("click", () => runCommand(command));
    commandResults.append(commandButton);
  });

  return commands;
}

function openCommandDock(trigger = document.activeElement) {
  if (commandDialog.open) {
    commandSearch.focus();
    return;
  }

  previousFocusedElement = trigger instanceof HTMLElement ? trigger : null;
  activeCommandIndex = 0;
  commandSearch.value = "";
  renderCommandResults();
  commandDialog.showModal();
  commandSearch.focus();
}

function closeCommandDock() {
  if (commandDialog.open) {
    commandDialog.close();
  }
}

function runCommand(command) {
  closeCommandDock();
  command.run();
}

function bindWindowControls() {
  windowElements.forEach((windowElement) => {
    const titlebar = windowElement.querySelector("[data-drag-handle]");
    const actions = windowElement.querySelector(".window-actions");

    if (!actions.querySelector('[data-action="maximize"]')) {
      const maximizeButton = document.createElement("button");
      maximizeButton.className = "window-action maximize-action";
      maximizeButton.type = "button";
      maximizeButton.dataset.action = "maximize";
      actions.insertBefore(maximizeButton, actions.querySelector('[data-action="minimize"]'));
    }
    updateMaximizeControl(windowElement);

    titlebar.addEventListener("focus", () => {
      if (!windowElement.hidden) {
        bringToFront(windowElement);
      }
    });
    titlebar.addEventListener("pointerdown", (event) => startDrag(event, windowElement, titlebar));
    titlebar.addEventListener("dblclick", (event) => {
      if (!event.target.closest("button")) {
        toggleMaximizeWindow(windowElement);
      }
    });

    windowElement.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (button.dataset.action === "minimize") {
          minimizeWindow(windowElement);
        }
        if (button.dataset.action === "maximize") {
          toggleMaximizeWindow(windowElement);
        }
        if (button.dataset.action === "close") {
          closeWindow(windowElement);
        }
      });
    });
  });
}

function startDrag(event, windowElement, handle) {
  if (isMobileLayout() || windowElement.dataset.maximized === "true" || event.button !== 0 || event.target.closest("button, input, a")) {
    return;
  }

  event.preventDefault();
  focusWindow(windowElement, { shouldFocus: false });
  const initial = currentWindowState(windowElement);
  const pointerStart = { x: event.clientX, y: event.clientY };
  const pointerId = event.pointerId;
  let dragging = true;

  handle.setPointerCapture(event.pointerId);
  windowElement.classList.add("is-dragging");

  const move = (moveEvent) => {
    if (!dragging || moveEvent.pointerId !== pointerId || moveEvent.buttons !== 1) {
      return;
    }
    setWindowPosition(
      windowElement,
      initial.x + moveEvent.clientX - pointerStart.x,
      initial.y + moveEvent.clientY - pointerStart.y,
    );
  };

  const finish = () => {
    if (!dragging) {
      return;
    }
    dragging = false;
    windowElement.classList.remove("is-dragging");
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", finish);
    handle.removeEventListener("pointercancel", finish);
    handle.removeEventListener("lostpointercapture", finish);
    persistLayout();
    announce(`${friendlyTitle(windowElement)} position saved.`);
  };

  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
  handle.addEventListener("lostpointercapture", finish);
}

function bindGlobalControls() {
  document.querySelectorAll("[data-open-window]").forEach((button) => {
    button.addEventListener("click", () => {
      const windowElement = windowsById.get(button.dataset.openWindow);
      if (windowElement) {
        restoreWindow(windowElement);
      }
    });
  });

  themeToggle.addEventListener("click", cycleTheme);
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.addEventListener("click", () => setTheme(button.dataset.themeChoice, { announceTheme: true }));
  });
  wallpaperInput.addEventListener("change", (event) => setTemporaryWallpaper(event.currentTarget.files?.[0]));
  resetWallpaperButton.addEventListener("click", () => removeCustomWallpaper({ announceRemoval: true }));
  performanceModeToggle.addEventListener("click", () => {
    setPerformanceMode(document.body.dataset.performanceMode !== "true", { announceMode: true });
  });
  signalStartButton.addEventListener("click", startSignalSprint);
  signalPressButton.addEventListener("click", pressSignalSprint);
  deskGridNewButton.addEventListener("click", createDeskGrid);
  focusListForm.addEventListener("submit", addFocusListItem);
  deskModePicker.addEventListener("change", () => {
    if (!deskModePicker.value) {
      return;
    }
    openDeskMode(deskModePicker.value);
    deskModePicker.value = "";
  });
  deskModeButtons.forEach((button) => {
    button.addEventListener("click", () => openDeskMode(button.dataset.deskMode));
  });
  gameTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => setActiveGamePanel(tab.dataset.gameTab, { focusTab: false }));
    tab.addEventListener("keydown", (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        return;
      }
      event.preventDefault();
      const nextIndex = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? gameTabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + gameTabs.length) % gameTabs.length;
      setActiveGamePanel(gameTabs[nextIndex].dataset.gameTab, { focusTab: true });
    });
  });
  consoleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    executeConsoleInput();
  });
  consoleRunButton.addEventListener("click", executeConsoleInput);
  consoleInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      executeConsoleInput();
    }
  });
  consoleClearButton.addEventListener("click", clearConsoleOutput);
  document.querySelector("#open-command-dock").addEventListener("click", (event) => openCommandDock(event.currentTarget));
  document.querySelector("#close-command-dock").addEventListener("click", closeCommandDock);
  document.querySelector("#save-workspace").addEventListener("click", () => persistLayout({ announceSave: true }));
  document.querySelector("#reset-layout").addEventListener("click", resetLayout);

  notebookTitleInput.addEventListener("input", saveNotebook);
  notebookBodyInput.addEventListener("input", saveNotebook);
  journalInput.addEventListener("input", saveJournal);
  document.querySelector("#clear-notebook").addEventListener("click", (event) => openClearDataDialog("notebook", event.currentTarget));
  document.querySelector("#clear-journal").addEventListener("click", (event) => openClearDataDialog("journal", event.currentTarget));
  startDictationButton.addEventListener("click", startDictation);
  stopDictationButton.addEventListener("click", stopDictation);
  speechLanguage.addEventListener("change", () => {
    if (isDictating) {
      stopDictation();
    }
    speechRecognition = null;
    voiceStatus.textContent = `Voice language set to ${speechLanguage.options[speechLanguage.selectedIndex].text}. Choose Start voice input when ready.`;
  });
  cancelClearDataButton.addEventListener("click", closeClearDataDialog);
  confirmClearDataButton.addEventListener("click", clearSelectedWriting);
  clearDataDialog.addEventListener("close", () => {
    clearDataTrigger?.focus({ preventScroll: true });
    clearDataTarget = null;
    clearDataTrigger = null;
  });

  projectSearch.addEventListener("input", () => renderProjects(projectSearch.value));
  commandSearch.addEventListener("input", () => {
    activeCommandIndex = 0;
    renderCommandResults();
  });

  commandSearch.addEventListener("keydown", (event) => {
    const commands = getFilteredCommands();
    if (event.key === "ArrowDown" && commands.length > 0) {
      event.preventDefault();
      activeCommandIndex = (activeCommandIndex + 1) % commands.length;
      renderCommandResults();
    }
    if (event.key === "ArrowUp" && commands.length > 0) {
      event.preventDefault();
      activeCommandIndex = (activeCommandIndex - 1 + commands.length) % commands.length;
      renderCommandResults();
    }
    if (event.key === "Enter" && commands[activeCommandIndex]) {
      event.preventDefault();
      runCommand(commands[activeCommandIndex]);
    }
  });

  commandDialog.addEventListener("close", () => {
    previousFocusedElement?.focus({ preventScroll: true });
    previousFocusedElement = null;
  });

  window.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openCommandDock(event.target);
      return;
    }

    if (event.key === "Escape" && commandDialog.open) {
      event.preventDefault();
      closeCommandDock();
      return;
    }

    if (!event.altKey || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      return;
    }

    if (commandDialog.open || event.target.closest?.("input, textarea, select")) {
      return;
    }

    const currentWindow = event.target.closest?.(".os-window") || windowsById.get(activeWindowId);
    if (!currentWindow || currentWindow.hidden || currentWindow.dataset.maximized === "true" || isMobileLayout()) {
      return;
    }

    const state = currentWindowState(currentWindow);
    const delta = {
      ArrowUp: [0, -MOVE_STEP],
      ArrowDown: [0, MOVE_STEP],
      ArrowLeft: [-MOVE_STEP, 0],
      ArrowRight: [MOVE_STEP, 0],
    }[event.key];

    event.preventDefault();
    setWindowPosition(currentWindow, state.x + delta[0], state.y + delta[1]);
    persistLayout();
    announce(`${friendlyTitle(currentWindow)} moved ${event.key.replace("Arrow", "").toLowerCase()}.`);
  });

  window.addEventListener("resize", () => {
    windowElements.forEach((windowElement) => {
      if (!windowElement.hidden) {
        const state = currentWindowState(windowElement);
        setWindowPosition(windowElement, state.x, state.y);
      }
    });
    updateLayoutSummary();
  });

  window.addEventListener("beforeunload", () => removeCustomWallpaper());
}

function initialize() {
  initializeTheme();
  initializePerformanceMode();
  renderProjects();
  initializeWritingTools();
  initializeGames();
  initializeLocalActivity();
  initializeFocusList();
  initializeRecentApps();
  applyLayout();
  bindWindowControls();
  bindGlobalControls();
  updateClock();
  window.setInterval(updateClock, 1000);
}

initialize();
