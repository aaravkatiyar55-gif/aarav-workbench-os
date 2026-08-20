export function renderWindowStrip(container, windows, activeWindowId, onSelect) {
  container.replaceChildren();

  const openWindows = windows.filter((windowItem) => windowItem.isOpen);
  if (openWindows.length === 0) {
    const empty = document.createElement("span");
    empty.className = "window-strip-empty";
    empty.textContent = "No apps open";
    container.append(empty);
    return;
  }

  openWindows.forEach((windowItem) => {
    const button = document.createElement("button");
    button.className = "window-strip-item";
    button.type = "button";
    button.textContent = windowItem.isMinimized ? `${windowItem.title} (minimized)` : windowItem.title;
    button.setAttribute("aria-label", `${windowItem.isMinimized ? "Restore" : "Focus"} ${windowItem.title}`);

    if (windowItem.id === activeWindowId && !windowItem.isMinimized) {
      button.setAttribute("aria-current", "true");
    }

    button.addEventListener("click", () => onSelect(windowItem.id));
    container.append(button);
  });
}
