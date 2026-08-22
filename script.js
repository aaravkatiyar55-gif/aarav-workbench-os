/**
 * script.js - Core Application Script for Aarav's Study Desk
 * Modular ES6 / Vanilla JavaScript
 */

import { projects } from './projects.js';

// --- LocalStorage Storage Keys (v2 for clean quiet-landing upgrade) ---
const KEYS = {
  TASKS: 'studydesk.tasks.v1',
  SCRATCHPAD: 'studydesk.scratchpad.v1',
  HANDOFF: 'studydesk.handoff.v1',
  WINDOWS: 'studydesk.windows.v2',
};

// ----------------------------------------------------
// DEFENSIVE NORMALIZATION & VALIDATION
// ----------------------------------------------------
function normalizeTasks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.text === 'string' && item.text.trim().length > 0)
    .map((item) => ({
      id: String(item.id),
      text: String(item.text).trim(),
      estimate: Number(item.estimate) > 0 ? Number(item.estimate) : 15,
      energy: ['low', 'medium', 'high'].includes(item.energy) ? item.energy : 'medium',
      done: Boolean(item.done),
      createdAt: Number(item.createdAt) || Date.now(),
    }));
}

function normalizeScratchpad(raw) {
  if (!raw || typeof raw !== 'object') {
    return { title: '', body: '', updatedAt: null };
  }
  return {
    title: typeof raw.title === 'string' ? raw.title : '',
    body: typeof raw.body === 'string' ? raw.body : '',
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : null,
  };
}

function normalizeHandoff(raw) {
  if (!raw || typeof raw !== 'object') {
    return { note: '', savedAt: null };
  }
  return {
    note: typeof raw.note === 'string' ? raw.note.trim() : '',
    savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : null,
  };
}

function normalizeWindowStates(raw) {
  const defaults = {
    'win-today': { isOpen: false, isMinimized: false, top: 20, left: 24 },
    'win-scratchpad': { isOpen: false, isMinimized: false, top: 20, left: 484 },
    'win-handoff': { isOpen: false, isMinimized: false, top: 400, left: 24 },
    'win-rescue': { isOpen: false, isMinimized: false, top: 40, left: 260 },
    'win-projects': { isOpen: false, isMinimized: false, top: 40, left: 280 },
  };

  if (!raw || typeof raw !== 'object') return defaults;
  const result = { ...defaults };
  Object.keys(defaults).forEach((id) => {
    if (raw[id] && typeof raw[id] === 'object') {
      result[id] = {
        isOpen: Boolean(raw[id].isOpen),
        isMinimized: Boolean(raw[id].isMinimized),
        top: Number.isFinite(raw[id].top) ? raw[id].top : defaults[id].top,
        left: Number.isFinite(raw[id].left) ? raw[id].left : defaults[id].left,
      };
    }
  });
  return result;
}

// Old-user storage cleanup / migration
function checkStorageMigration() {
  try {
    const legacyV1 = localStorage.getItem('studydesk.windows.v1');
    const v2Exists = localStorage.getItem(KEYS.WINDOWS);
    if (!v2Exists && legacyV1) {
      localStorage.removeItem('studydesk.windows.v1');
    }
    // Clean up obsolete OS workbench keys if present
    ['workbench_notes', 'workbench_focus_list', 'workbench_window_states', 'workbench_theme'].forEach((k) => {
      localStorage.removeItem(k);
    });
  } catch {}
}

// Safe storage utilities
function loadStorage(key, fallback, normalizer) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return normalizer ? normalizer(parsed) : parsed;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage write error:', e);
  }
}

// Run migration before reading state
checkStorageMigration();

// ----------------------------------------------------
// 1. STATE & DATA INITIALIZATION
// ----------------------------------------------------
let tasks = loadStorage(KEYS.TASKS, [], normalizeTasks);
let scratchpad = loadStorage(KEYS.SCRATCHPAD, { title: '', body: '', updatedAt: null }, normalizeScratchpad);
let handoff = loadStorage(KEYS.HANDOFF, { note: '', savedAt: null }, normalizeHandoff);
let windowStates = loadStorage(
  KEYS.WINDOWS,
  {
    'win-today': { isOpen: false, isMinimized: false, top: 20, left: 24 },
    'win-scratchpad': { isOpen: false, isMinimized: false, top: 20, left: 484 },
    'win-handoff': { isOpen: false, isMinimized: false, top: 400, left: 24 },
    'win-rescue': { isOpen: false, isMinimized: false, top: 40, left: 260 },
    'win-projects': { isOpen: false, isMinimized: false, top: 40, left: 280 },
  },
  normalizeWindowStates
);

let highestZIndex = 50;

// ----------------------------------------------------
// 2. WINDOW MANAGER & DRAGGING (WITH BOUNDS CLAMPING)
// ----------------------------------------------------
function clampWindowPosition(win, state) {
  if (window.innerWidth <= 640) {
    win.style.top = '';
    win.style.left = '';
    return;
  }

  const winWidth = win.offsetWidth || 440;
  const maxLeft = Math.max(10, window.innerWidth - winWidth - 10);
  const maxTop = Math.max(60, window.innerHeight - 80);

  const rawLeft = state && Number.isFinite(state.left) ? state.left : 24;
  const rawTop = state && Number.isFinite(state.top) ? state.top : 20;

  const boundedLeft = Math.min(Math.max(10, rawLeft), maxLeft);
  const boundedTop = Math.min(Math.max(60, rawTop), maxTop);

  win.style.left = `${boundedLeft}px`;
  win.style.top = `${boundedTop}px`;
}

function initWindowManager() {
  const windows = document.querySelectorAll('.desk-window');

  windows.forEach((win) => {
    const id = win.id;
    const header = win.querySelector('.window-header');
    const state = windowStates[id] || { isOpen: false, isMinimized: false, top: 20, left: 24 };

    // Apply quiet landing initial state
    win.hidden = !state.isOpen;

    if (state.isMinimized) {
      win.classList.add('is-minimized');
    }

    // Clamp and position window on startup
    clampWindowPosition(win, state);

    // Bring to front on pointerdown
    win.addEventListener('pointerdown', () => bringWindowToFront(win));

    // Pointer-based Dragging
    if (header) {
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let initialLeft = 0;
      let initialTop = 0;

      header.addEventListener('pointerdown', (event) => {
        if (event.target.closest('.window-ctrl-btn')) return;
        if (window.innerWidth <= 640) return; // Disable free drag on mobile

        isDragging = true;
        bringWindowToFront(win);
        header.setPointerCapture(event.pointerId);

        const rect = win.getBoundingClientRect();
        startX = event.clientX;
        startY = event.clientY;
        initialLeft = rect.left;
        initialTop = rect.top;
      });

      header.addEventListener('pointermove', (event) => {
        if (!isDragging) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;

        const maxLeft = Math.max(10, window.innerWidth - win.offsetWidth - 10);
        const maxTop = Math.max(60, window.innerHeight - 80);

        const boundedLeft = Math.min(Math.max(10, initialLeft + dx), maxLeft);
        const boundedTop = Math.min(Math.max(60, initialTop + dy), maxTop);

        win.style.left = `${boundedLeft}px`;
        win.style.top = `${boundedTop}px`;
      });

      const stopDrag = (event) => {
        if (!isDragging) return;
        isDragging = false;
        try {
          header.releasePointerCapture(event.pointerId);
        } catch {}

        const winId = win.id;
        if (!windowStates[winId]) windowStates[winId] = {};
        windowStates[winId].top = parseInt(win.style.top, 10) || 20;
        windowStates[winId].left = parseInt(win.style.left, 10) || 24;
        saveStorage(KEYS.WINDOWS, windowStates);
      };

      header.addEventListener('pointerup', stopDrag);
      header.addEventListener('pointercancel', stopDrag);
    }

    // Window control buttons
    const minBtn = win.querySelector('[data-action="minimize"]');
    const closeBtn = win.querySelector('[data-action="close"]');

    if (minBtn) {
      minBtn.addEventListener('click', () => toggleMinimizeWindow(id));
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeWindow(id));
    }
  });

  // Dock launcher button event delegation
  document.querySelectorAll('.launcher-btn, .hub-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      if (targetId) {
        openWindow(targetId);
      }
    });
  });

  // Reset Desk Button: returns to clean quiet desk
  const resetBtn = document.getElementById('reset-desk-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetDeskLayout);
  }

  // Handle window resize dynamically
  window.addEventListener('resize', () => {
    if (window.innerWidth > 640) {
      document.querySelectorAll('.desk-window').forEach((win) => {
        const id = win.id;
        const state = windowStates[id];
        if (state && !win.hidden) {
          clampWindowPosition(win, state);
        }
      });
    }
  });

  updateDockAndHub();
}

function bringWindowToFront(win) {
  highestZIndex += 1;
  win.style.zIndex = highestZIndex;
  document.querySelectorAll('.desk-window.is-active').forEach((w) => w.classList.remove('is-active'));
  win.classList.add('is-active');
}

function openWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  win.hidden = false;
  win.classList.remove('is-minimized');
  bringWindowToFront(win);

  if (!windowStates[id]) windowStates[id] = {};
  windowStates[id].isOpen = true;
  windowStates[id].isMinimized = false;
  clampWindowPosition(win, windowStates[id]);
  saveStorage(KEYS.WINDOWS, windowStates);

  updateDockAndHub();
}

function closeWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  win.hidden = true;

  if (!windowStates[id]) windowStates[id] = {};
  windowStates[id].isOpen = false;
  saveStorage(KEYS.WINDOWS, windowStates);

  updateDockAndHub();
}

function toggleMinimizeWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  const isMin = win.classList.toggle('is-minimized');

  if (!windowStates[id]) windowStates[id] = {};
  windowStates[id].isMinimized = isMin;
  saveStorage(KEYS.WINDOWS, windowStates);
}

function updateDockAndHub() {
  const openWindows = Array.from(document.querySelectorAll('.desk-window')).filter((w) => !w.hidden);

  document.querySelectorAll('.launcher-btn').forEach((btn) => {
    const target = btn.dataset.target;
    const win = document.getElementById(target);
    const isOpen = win && !win.hidden;
    btn.classList.toggle('is-active', Boolean(isOpen));
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  const hub = document.getElementById('desk-hub');
  if (hub) {
    hub.hidden = openWindows.length > 0;
  }
}

function resetDeskLayout() {
  // Quiet landing: all windows closed, returning to initial clean hub
  windowStates = {
    'win-today': { isOpen: false, isMinimized: false, top: 20, left: 24 },
    'win-scratchpad': { isOpen: false, isMinimized: false, top: 20, left: 484 },
    'win-handoff': { isOpen: false, isMinimized: false, top: 400, left: 24 },
    'win-rescue': { isOpen: false, isMinimized: false, top: 40, left: 260 },
    'win-projects': { isOpen: false, isMinimized: false, top: 40, left: 280 },
  };
  saveStorage(KEYS.WINDOWS, windowStates);

  Object.entries(windowStates).forEach(([id, state]) => {
    const win = document.getElementById(id);
    if (!win) return;
    win.hidden = !state.isOpen;
    win.classList.toggle('is-minimized', state.isMinimized);
    clampWindowPosition(win, state);
  });

  updateDockAndHub();
}

// ----------------------------------------------------
// 3. TODAY'S TASK LOGIC & SINGLE NEXT ACTION
// ----------------------------------------------------
function initTodayTasks() {
  const form = document.getElementById('add-task-form');
  const input = document.getElementById('task-input');
  const estimateSelect = document.getElementById('task-estimate');
  const energySelect = document.getElementById('task-energy');
  const nextCompleteBtn = document.getElementById('next-action-complete-btn');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      const newTask = {
        id: `task-${Date.now()}`,
        text,
        estimate: Number(estimateSelect.value) || 15,
        energy: energySelect.value || 'medium',
        done: false,
        createdAt: Date.now(),
      };

      tasks.unshift(newTask);
      saveStorage(KEYS.TASKS, tasks);
      renderTasks();
      input.value = '';
      input.focus();
    });
  }

  if (nextCompleteBtn) {
    nextCompleteBtn.addEventListener('click', () => {
      const nextTask = tasks.find((t) => !t.done);
      if (nextTask) {
        toggleTaskDone(nextTask.id);
      }
    });
  }

  renderTasks();
}

function renderTasks() {
  const listEl = document.getElementById('task-list');
  const counterEl = document.getElementById('task-counter');
  const nextTitleEl = document.getElementById('next-action-title');
  const nextMetaEl = document.getElementById('next-action-meta');
  const nextCompleteBtn = document.getElementById('next-action-complete-btn');

  if (!listEl) return;

  const pending = tasks.filter((t) => !t.done);
  const completed = tasks.filter((t) => t.done);

  if (counterEl) {
    counterEl.textContent = `${pending.length} pending · ${completed.length} done`;
  }

  const nextTask = pending[0];
  if (nextTask) {
    nextTitleEl.textContent = nextTask.text;
    nextMetaEl.textContent = `⏱️ ${nextTask.estimate} min · ⚡ ${nextTask.energy.toUpperCase()} Energy`;
    if (nextCompleteBtn) nextCompleteBtn.hidden = false;
  } else {
    nextTitleEl.textContent = tasks.length === 0 ? 'Desk is clear. Add one task above.' : '🎉 All tasks done! Ready for a break.';
    nextMetaEl.textContent = '';
    if (nextCompleteBtn) nextCompleteBtn.hidden = true;
  }

  listEl.innerHTML = '';
  tasks.forEach((task) => {
    const li = document.createElement('li');
    li.className = `task-item ${task.done ? 'is-done' : ''}`;

    const left = document.createElement('div');
    left.className = 'task-item__left';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = task.done;
    checkbox.setAttribute('aria-label', `Mark "${task.text}" as ${task.done ? 'pending' : 'complete'}`);
    checkbox.addEventListener('change', () => toggleTaskDone(task.id));

    const textSpan = document.createElement('span');
    textSpan.className = 'task-text';
    textSpan.textContent = task.text;

    left.append(checkbox, textSpan);

    const metaTag = document.createElement('span');
    metaTag.className = 'task-meta-tag';
    metaTag.textContent = `${task.estimate}m · ${task.energy[0].toUpperCase()}`;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'task-del-btn';
    delBtn.setAttribute('aria-label', `Delete task "${task.text}"`);
    delBtn.innerHTML = '✕';
    delBtn.addEventListener('click', () => deleteTask(task.id));

    li.append(left, metaTag, delBtn);
    listEl.append(li);
  });
}

function toggleTaskDone(id) {
  tasks = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  saveStorage(KEYS.TASKS, tasks);
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  saveStorage(KEYS.TASKS, tasks);
  renderTasks();
}

// ----------------------------------------------------
// 4. SCRATCHPAD WITH DEBOUNCED AUTO-SAVE
// ----------------------------------------------------
function initScratchpad() {
  const titleInput = document.getElementById('scratchpad-title');
  const bodyTextarea = document.getElementById('scratchpad-body');
  const statusEl = document.getElementById('scratchpad-save-status');
  const clearBtn = document.getElementById('scratchpad-clear-btn');

  if (titleInput) titleInput.value = scratchpad.title || '';
  if (bodyTextarea) bodyTextarea.value = scratchpad.body || '';

  let debounceTimer = null;

  const triggerSave = () => {
    if (statusEl) statusEl.textContent = 'Saving...';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      scratchpad = {
        title: titleInput ? titleInput.value : '',
        body: bodyTextarea ? bodyTextarea.value : '',
        updatedAt: Date.now(),
      };
      saveStorage(KEYS.SCRATCHPAD, scratchpad);
      if (statusEl) statusEl.textContent = 'Saved to browser ✓';
    }, 350);
  };

  if (titleInput) titleInput.addEventListener('input', triggerSave);
  if (bodyTextarea) bodyTextarea.addEventListener('input', triggerSave);

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Clear scratchpad note?')) {
        if (titleInput) titleInput.value = '';
        if (bodyTextarea) bodyTextarea.value = '';
        scratchpad = { title: '', body: '', updatedAt: Date.now() };
        saveStorage(KEYS.SCRATCHPAD, scratchpad);
        if (statusEl) statusEl.textContent = 'Scratchpad cleared';
      }
    });
  }
}

// ----------------------------------------------------
// 5. SESSION HANDOFF & RESUME BANNER (DUPLICATE-SAFE)
// ----------------------------------------------------
function initHandoff() {
  const form = document.getElementById('handoff-form');
  const input = document.getElementById('handoff-input');
  const statusEl = document.getElementById('handoff-save-status');
  const previewEl = document.getElementById('saved-handoff-preview');
  const timeEl = document.getElementById('saved-handoff-time');
  const resumeBanner = document.getElementById('resume-banner');
  const resumeText = document.getElementById('resume-text');
  const adoptBtn = document.getElementById('adopt-handoff-btn');
  const dismissBtn = document.getElementById('dismiss-handoff-btn');

  const renderHandoffPreview = () => {
    if (handoff.note) {
      if (previewEl) previewEl.textContent = `"${handoff.note}"`;
      if (timeEl && handoff.savedAt) {
        const d = new Date(handoff.savedAt);
        timeEl.textContent = `Saved on ${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      if (input && !input.value) input.value = handoff.note;
    } else {
      if (previewEl) previewEl.textContent = 'No handoff saved yet.';
      if (timeEl) timeEl.textContent = '';
    }
  };

  if (handoff.note && resumeBanner && resumeText) {
    resumeText.textContent = handoff.note;
    resumeBanner.hidden = false;
  }

  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const note = input.value.trim();
      if (!note) return;

      handoff = { note, savedAt: Date.now() };
      saveStorage(KEYS.HANDOFF, handoff);
      renderHandoffPreview();

      if (statusEl) {
        statusEl.textContent = 'Handoff saved! ✓';
        setTimeout(() => { statusEl.textContent = ''; }, 3000);
      }
    });
  }

  // Adopt Handoff: adds to tasks and clears stored handoff so it does not duplicate on refresh
  if (adoptBtn) {
    adoptBtn.addEventListener('click', () => {
      if (handoff.note) {
        tasks.unshift({
          id: `task-${Date.now()}`,
          text: handoff.note,
          estimate: 15,
          energy: 'medium',
          done: false,
          createdAt: Date.now(),
        });
        saveStorage(KEYS.TASKS, tasks);
        renderTasks();

        // Clear stored handoff so it does not duplicate on reload
        handoff = { note: '', savedAt: null };
        saveStorage(KEYS.HANDOFF, handoff);
        renderHandoffPreview();
        if (input) input.value = '';

        openWindow('win-today');
        if (resumeBanner) resumeBanner.hidden = true;
      }
    });
  }

  if (dismissBtn && resumeBanner) {
    dismissBtn.addEventListener('click', () => {
      resumeBanner.hidden = true;
    });
  }

  renderHandoffPreview();
}

// ----------------------------------------------------
// 6. 5-MINUTE RESCUE FEATURE
// ----------------------------------------------------
function initRescueFeature() {
  document.querySelectorAll('.rescue-card').forEach((card) => {
    card.addEventListener('click', () => {
      const taskText = card.dataset.task;
      const estimate = Number(card.dataset.estimate) || 5;
      const energy = card.dataset.energy || 'low';

      if (taskText) {
        tasks.unshift({
          id: `task-${Date.now()}`,
          text: taskText,
          estimate,
          energy,
          done: false,
          createdAt: Date.now(),
        });
        saveStorage(KEYS.TASKS, tasks);
        renderTasks();
        openWindow('win-today');
      }
    });
  });
}

// ----------------------------------------------------
// 7. PROJECT SHELF CARDS RENDERER
// ----------------------------------------------------
function initProjectShelf() {
  const container = document.getElementById('projects-container');
  if (!container) return;

  container.innerHTML = '';
  projects.forEach((proj) => {
    const card = document.createElement('article');
    card.className = 'project-item';

    const header = document.createElement('div');
    header.className = 'project-item__header';

    const title = document.createElement('h3');
    title.className = 'project-item__title';
    title.textContent = proj.title;

    const category = document.createElement('span');
    category.className = 'project-item__category';
    category.textContent = proj.category;

    header.append(title, category);

    const desc = document.createElement('p');
    desc.className = 'project-item__desc';
    desc.textContent = proj.description;

    const links = document.createElement('div');
    links.className = 'project-item__links';

    if (proj.hasDemo && proj.demoUrl) {
      const demoLink = document.createElement('a');
      demoLink.href = proj.demoUrl;
      demoLink.target = '_blank';
      demoLink.rel = 'noopener noreferrer';
      demoLink.className = 'project-link';
      demoLink.textContent = 'Launch Demo ↗';
      links.append(demoLink);
    } else {
      const noDemoSpan = document.createElement('span');
      noDemoSpan.className = 'project-link project-link--source';
      noDemoSpan.textContent = proj.statusText || 'Demo: Coming soon';
      links.append(noDemoSpan);
    }

    if (proj.sourceUrl) {
      const sourceLink = document.createElement('a');
      sourceLink.href = proj.sourceUrl;
      sourceLink.target = '_blank';
      sourceLink.rel = 'noopener noreferrer';
      sourceLink.className = 'project-link project-link--source';
      sourceLink.textContent = 'Source Code ↗';
      links.append(sourceLink);
    }

    card.append(header, desc, links);
    container.append(card);
  });
}

// ----------------------------------------------------
// 8. LIVE DESK CLOCK
// ----------------------------------------------------
function initDeskClock() {
  const clockEl = document.getElementById('desk-clock');
  if (!clockEl) return;

  const update = () => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  update();
  setInterval(update, 1000);
}

// ----------------------------------------------------
// 9. BOOTSTRAP ON LOAD
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initDeskClock();
  initWindowManager();
  initTodayTasks();
  initScratchpad();
  initHandoff();
  initRescueFeature();
  initProjectShelf();
});
