import { projects } from "./projects.js";

const STORAGE_PREFIX = "aarav-workbench-os";
const LAYOUT_KEY = `${STORAGE_PREFIX}.layout.v1`;
const LEGACY_THEME_KEY = `${STORAGE_PREFIX}.theme.v1`;
const THEME_KEY = `${STORAGE_PREFIX}.theme.v2`;
const NOTEBOOK_KEY = `${STORAGE_PREFIX}.notebook.v1`;
const JOURNAL_KEY = `${STORAGE_PREFIX}.journal.v1`;
const PERFORMANCE_KEY = `${STORAGE_PREFIX}.performance.v1`;
const LAYOUT_VERSION = 1;
const MOVE_STEP = 24;
const MAX_WALLPAPER_BYTES = 4 * 1024 * 1024;
const THEMES = {
  paper: "Paper",
  night: "Night",
  moss: "Moss",
  ember: "Ember",
};

const desktop = document.querySelector("#desktop");
const statusMessage = document.querySelector("#status-message");
const clock = document.querySelector("#clock");
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
const windowElements = [...document.querySelectorAll(".os-window")];
const windowsById = new Map(windowElements.map((windowElement) => [windowElement.dataset.windowId, windowElement]));

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
  } catch {
    if (!storageWarningShown) {
      storageWarningShown = true;
      announce("This browser cannot clear the saved workspace right now.");
    }
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
    isOpen: true,
    isMinimized: windowElement.dataset.startMinimized === "true",
    z: 1,
  };
}

function currentWindowState(windowElement) {
  return {
    x: asFiniteNumber(Number.parseFloat(windowElement.style.left), Number(windowElement.dataset.defaultX) || 0),
    y: asFiniteNumber(Number.parseFloat(windowElement.style.top), Number(windowElement.dataset.defaultY) || 0),
    isOpen: !windowElement.hidden,
    isMinimized: windowElement.dataset.minimized === "true",
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

function updateLayoutSummary() {
  const openWindows = windowElements.filter((windowElement) => !windowElement.hidden);
  const minimizedWindows = openWindows.filter((windowElement) => windowElement.dataset.minimized === "true");
  const visibleWindows = openWindows.length - minimizedWindows.length;
  layoutSummary.textContent = `${visibleWindows} visible, ${minimizedWindows.length} minimized. This layout is saved only in this browser.`;
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
  windowElement.dataset.minimized = "true";
  updateDockItem(windowElement);
  persistLayout();
  document.querySelector(`[data-open-window="${windowElement.dataset.windowId}"]`)?.focus({ preventScroll: true });
  announce(`${friendlyTitle(windowElement)} minimized.`);
}

function closeWindow(windowElement) {
  if (windowElement.dataset.windowId === "journal") {
    stopDictation();
  }
  windowElement.hidden = true;
  windowElement.dataset.minimized = "false";
  updateDockItem(windowElement);
  persistLayout();
  document.querySelector(`[data-open-window="${windowElement.dataset.windowId}"]`)?.focus({ preventScroll: true });
  announce(`${friendlyTitle(windowElement)} closed. Use the dock to bring it back.`);
}

function restoreWindow(windowElement) {
  focusWindow(windowElement, { shouldFocus: true, announceFocus: true });
  persistLayout();
}

function applyLayout() {
  const savedLayout = readSavedLayout();
  let highestSavedZ = 1;

  windowElements.forEach((windowElement, index) => {
    const fallback = { ...defaultWindowState(windowElement), z: index + 1 };
    const saved = normalizeSavedWindowState(savedLayout?.windows?.[windowElement.dataset.windowId], fallback);

    windowElement.hidden = !saved.isOpen;
    windowElement.dataset.minimized = String(saved.isMinimized && saved.isOpen);
    windowElement.style.zIndex = String(saved.z);
    setWindowPosition(windowElement, saved.x, saved.y);
    highestSavedZ = Math.max(highestSavedZ, saved.z);
  });

  topZIndex = highestSavedZ;
  updateAllDockItems();
  updateLayoutSummary();
}

function resetLayout() {
  safeRemove(LAYOUT_KEY);

  windowElements.forEach((windowElement, index) => {
    const fallback = defaultWindowState(windowElement);
    windowElement.hidden = !fallback.isOpen;
    windowElement.dataset.minimized = String(fallback.isMinimized);
    windowElement.style.zIndex = String(index + 1);
    setWindowPosition(windowElement, fallback.x, fallback.y);
  });

  topZIndex = windowElements.length + 1;
  updateAllDockItems();
  updateLayoutSummary();
  announce("Default workspace layout restored. Your theme was kept.");
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
  if (!file) {
    return;
  }

  if (!allowedTypes.has(file.type)) {
    wallpaperInput.value = "";
    wallpaperStatus.textContent = "Choose a PNG, JPEG, or WebP image. No file was used.";
    return;
  }

  if (file.size > MAX_WALLPAPER_BYTES) {
    wallpaperInput.value = "";
    wallpaperStatus.textContent = "Choose an image smaller than 4 MB. No file was used.";
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
  const updatedAt = new Date().toISOString();
  const saved = safeSet(NOTEBOOK_KEY, JSON.stringify({ version: 1, title, body, updatedAt }));
  updateWritingStatus(notebookStatus, saved, updatedAt, "This browser cannot save the notebook right now.");
}

function saveJournal() {
  const body = journalInput.value.slice(0, journalInput.maxLength);
  const updatedAt = new Date().toISOString();
  const saved = safeSet(JOURNAL_KEY, JSON.stringify({ version: 1, body, updatedAt }));
  updateWritingStatus(journalStatus, saved, updatedAt, "This browser cannot save the journal right now.");
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
    notebookTitleInput.value = "";
    notebookBodyInput.value = "";
    safeRemove(NOTEBOOK_KEY);
    updateWritingStatus(notebookStatus, false, null, "Notebook cleared from this browser.");
    announce("Notebook cleared from this browser.");
  }

  if (clearDataTarget === "journal") {
    journalInput.value = "";
    safeRemove(JOURNAL_KEY);
    updateWritingStatus(journalStatus, false, null, "Journal cleared from this browser.");
    announce("Story journal cleared from this browser.");
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
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = document.documentElement.lang || navigator.language || "en-US";

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
    setDictationState(true, "Listening… spoken words will be added to this local draft.");
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

    titlebar.addEventListener("focus", () => {
      if (!windowElement.hidden) {
        bringToFront(windowElement);
      }
    });
    titlebar.addEventListener("pointerdown", (event) => startDrag(event, windowElement, titlebar));

    windowElement.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (button.dataset.action === "minimize") {
          minimizeWindow(windowElement);
        }
        if (button.dataset.action === "close") {
          closeWindow(windowElement);
        }
      });
    });
  });
}

function startDrag(event, windowElement, handle) {
  if (isMobileLayout() || event.button !== 0 || event.target.closest("button, input, a")) {
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
    if (!currentWindow || currentWindow.hidden || isMobileLayout()) {
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
  applyLayout();
  bindWindowControls();
  bindGlobalControls();
  updateClock();
  window.setInterval(updateClock, 1000);
}

initialize();
