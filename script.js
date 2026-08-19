import { projects } from "./projects.js";

const STORAGE_PREFIX = "aarav-workbench-os";
const LAYOUT_KEY = `${STORAGE_PREFIX}.layout.v1`;
const THEME_KEY = `${STORAGE_PREFIX}.theme.v1`;
const LAYOUT_VERSION = 1;
const MOVE_STEP = 24;

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
const windowElements = [...document.querySelectorAll(".os-window")];
const windowsById = new Map(windowElements.map((windowElement) => [windowElement.dataset.windowId, windowElement]));

let topZIndex = 10;
let activeWindowId = "welcome";
let activeCommandIndex = 0;
let previousFocusedElement = null;
let storageWarningShown = false;

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
  windowElement.dataset.minimized = "true";
  updateDockItem(windowElement);
  persistLayout();
  document.querySelector(`[data-open-window="${windowElement.dataset.windowId}"]`)?.focus({ preventScroll: true });
  announce(`${friendlyTitle(windowElement)} minimized.`);
}

function closeWindow(windowElement) {
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

function setTheme(theme, { announceTheme = false } = {}) {
  const nextTheme = theme === "night" ? "night" : "paper";
  document.body.dataset.theme = nextTheme;
  themeToggle.setAttribute("aria-pressed", String(nextTheme === "night"));
  themeToggle.textContent = nextTheme === "night" ? "Use paper theme" : "Use low-light theme";
  safeSet(THEME_KEY, nextTheme);

  if (announceTheme) {
    announce(nextTheme === "night" ? "Low-light theme enabled." : "Paper theme enabled.");
  }
}

function initializeTheme() {
  const savedTheme = safeGet(THEME_KEY);
  setTheme(savedTheme === "night" ? "night" : "paper");
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
      id: "toggle-theme",
      label: "Toggle paper / low-light theme",
      detail: "Change the local color preference",
      run: () => setTheme(document.body.dataset.theme === "night" ? "paper" : "night", { announceTheme: true }),
    },
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

  themeToggle.addEventListener("click", () => {
    setTheme(document.body.dataset.theme === "night" ? "paper" : "night", { announceTheme: true });
  });
  document.querySelector("#open-command-dock").addEventListener("click", (event) => openCommandDock(event.currentTarget));
  document.querySelector("#close-command-dock").addEventListener("click", closeCommandDock);
  document.querySelector("#save-workspace").addEventListener("click", () => persistLayout({ announceSave: true }));
  document.querySelector("#reset-layout").addEventListener("click", resetLayout);

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
}

function initialize() {
  initializeTheme();
  applyLayout();
  renderProjects();
  bindWindowControls();
  bindGlobalControls();
  updateClock();
  window.setInterval(updateClock, 1000);
}

initialize();
