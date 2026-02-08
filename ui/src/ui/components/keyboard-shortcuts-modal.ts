/**
 * Keyboard Shortcuts Help Modal
 * Shows all available keyboard shortcuts grouped by category
 * Includes search functionality and comprehensive shortcut listing
 */

import { html, render, nothing, type TemplateResult } from "lit";
import { icon } from "../icons.js";

type ShortcutEntry = {
  keys: string[];
  description: string;
  when?: string;
};

type ShortcutCategory = {
  name: string;
  icon: string;
  shortcuts: ShortcutEntry[];
};

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? "");
const MOD = isMac ? "⌘" : "Ctrl";

const SHORTCUTS: ShortcutCategory[] = [
  {
    name: "Global",
    icon: "command",
    shortcuts: [
      { keys: [MOD, "K"], description: "Open command palette" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
      { keys: ["Esc"], description: "Close modal / palette / cancel" },
      { keys: [MOD, "R"], description: "Refresh current view" },
    ],
  },
  {
    name: "Navigation",
    icon: "compass",
    shortcuts: [
      { keys: [MOD, "1"], description: "Go to Chat" },
      { keys: [MOD, "2"], description: "Go to Overview" },
      { keys: [MOD, "3"], description: "Go to Channels" },
      { keys: [MOD, "4"], description: "Go to Sessions" },
      { keys: [MOD, "5"], description: "Go to Usage" },
      { keys: [MOD, "6"], description: "Go to Cron Jobs" },
      { keys: [MOD, "7"], description: "Go to Agents" },
      { keys: [MOD, "8"], description: "Go to Skills" },
      { keys: [MOD, "9"], description: "Go to Nodes" },
      { keys: [MOD, "0"], description: "Go to Logs" },
      { keys: [MOD, ","], description: "Go to Config" },
    ],
  },
  {
    name: "Chat",
    icon: "messageSquare",
    shortcuts: [
      { keys: [MOD, "Enter"], description: "Send message", when: "Chat view" },
      { keys: ["/"], description: "Focus chat input", when: "Chat view" },
    ],
  },
  {
    name: "Logs",
    icon: "scrollText",
    shortcuts: [
      { keys: ["/"], description: "Focus search filter", when: "Logs view" },
      { keys: ["G"], description: "Jump to bottom", when: "Logs view" },
      { keys: ["F"], description: "Toggle auto-follow", when: "Logs view" },
    ],
  },
  {
    name: "Config",
    icon: "settings",
    shortcuts: [
      { keys: [MOD, "S"], description: "Save config", when: "Config view" },
      { keys: ["/"], description: "Focus search", when: "Config view" },
    ],
  },
  {
    name: "Skills",
    icon: "zap",
    shortcuts: [{ keys: ["/"], description: "Focus search filter", when: "Skills view" }],
  },
  {
    name: "Command Palette",
    icon: "search",
    shortcuts: [
      { keys: ["↑", "↓"], description: "Navigate items" },
      { keys: ["Enter"], description: "Select item" },
      { keys: ["Tab"], description: "Cycle categories" },
      { keys: [MOD, "D"], description: "Toggle favorite" },
      { keys: ["Backspace"], description: "Reset category filter", when: "Empty query" },
    ],
  },
];

let isOpen = false;
let searchQuery = "";
let isListeningForEscape = false;

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    e.preventDefault();
    hideKeyboardShortcutsModal();
  }
};

/** Filter shortcuts by a search query (matches description and key names). */
function filterShortcuts(categories: ShortcutCategory[], query: string): ShortcutCategory[] {
  if (!query.trim()) return categories;
  const q = query.toLowerCase();
  const result: ShortcutCategory[] = [];
  for (const cat of categories) {
    const filtered = cat.shortcuts.filter(
      (s) =>
        s.description.toLowerCase().includes(q) ||
        s.keys.some((k) => k.toLowerCase().includes(q)) ||
        (s.when && s.when.toLowerCase().includes(q)),
    );
    if (filtered.length > 0) {
      result.push({ ...cat, shortcuts: filtered });
    }
  }
  return result;
}

function renderModal(): TemplateResult | typeof nothing {
  if (!isOpen) return nothing;

  const handleClose = () => {
    hideKeyboardShortcutsModal();
  };

  const handleBackdropClick = (e: Event) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleSearch = (e: Event) => {
    searchQuery = (e.target as HTMLInputElement).value;
    renderToContainer();
  };

  const filteredCategories = filterShortcuts(SHORTCUTS, searchQuery);
  const totalShortcuts = filteredCategories.reduce((sum, cat) => sum + cat.shortcuts.length, 0);

  return html`
    <div
      class="modal-backdrop keyboard-shortcuts-modal-backdrop"
      @click=${handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
    >
      <div class="modal keyboard-shortcuts-modal">
        <div class="modal-header">
          <h2 id="keyboard-shortcuts-title" class="modal-title">
            ${icon("keyboard", { size: 20 })}
            Keyboard Shortcuts
          </h2>
          <button
            class="btn btn--sm btn--icon"
            @click=${handleClose}
            aria-label="Close keyboard shortcuts"
            title="Close"
          >
            ${icon("x", { size: 16 })}
          </button>
        </div>
        <div class="keyboard-shortcuts-search">
          <div class="keyboard-shortcuts-search__wrapper">
            ${icon("search", { size: 16, class: "keyboard-shortcuts-search__icon" })}
            <input
              class="keyboard-shortcuts-search__input"
              type="text"
              placeholder="Search shortcuts..."
              .value=${searchQuery}
              @input=${handleSearch}
              aria-label="Search keyboard shortcuts"
              autofocus
            />
            ${
              searchQuery
                ? html`<button
                  class="keyboard-shortcuts-search__clear"
                  @click=${() => {
                    searchQuery = "";
                    renderToContainer();
                  }}
                  aria-label="Clear search"
                >
                  ${icon("x", { size: 14 })}
                </button>`
                : nothing
            }
          </div>
        </div>
        <div class="modal-body keyboard-shortcuts-body" role="list" aria-label="Keyboard shortcuts list">
          ${
            filteredCategories.length === 0
              ? html`<div class="keyboard-shortcuts-empty">
                ${icon("search", { size: 24 })}
                <span>No shortcuts match "${searchQuery}"</span>
              </div>`
              : html`
                <div class="keyboard-shortcuts-grid">
                  ${filteredCategories.map(
                    (category) => html`
                      <div class="keyboard-shortcuts-category" role="listitem">
                        <h3 class="keyboard-shortcuts-category__title">
                          ${icon(category.icon as Parameters<typeof icon>[0], { size: 14 })}
                          ${category.name}
                          <span class="keyboard-shortcuts-category__count">${category.shortcuts.length}</span>
                        </h3>
                        <div class="keyboard-shortcuts-list">
                          ${category.shortcuts.map(
                            (shortcut) => html`
                              <div class="keyboard-shortcut">
                                <div class="keyboard-shortcut__keys">
                                  ${shortcut.keys.map(
                                    (key, i) =>
                                      html`${
                                        i > 0
                                          ? html`
                                              <span class="keyboard-shortcut__plus">+</span>
                                            `
                                          : nothing
                                      }<kbd class="keyboard-shortcut__key">${key}</kbd>`,
                                  )}
                                </div>
                                <div class="keyboard-shortcut__desc">
                                  ${shortcut.description}
                                  ${
                                    shortcut.when
                                      ? html`<span class="keyboard-shortcut__when">${shortcut.when}</span>`
                                      : nothing
                                  }
                                </div>
                              </div>
                            `,
                          )}
                        </div>
                      </div>
                    `,
                  )}
                </div>
              `
          }
        </div>
        <div class="modal-footer keyboard-shortcuts-footer">
          <span class="keyboard-shortcuts-tip">
            Press <kbd>?</kbd> anytime to show this help
          </span>
          <span class="keyboard-shortcuts-count">
            ${totalShortcuts} shortcut${totalShortcuts !== 1 ? "s" : ""}
          </span>
          <button class="btn btn--secondary" @click=${handleClose}>Close</button>
        </div>
      </div>
    </div>
  `;
}

function getOrCreateContainer(): HTMLElement {
  let container = document.getElementById("keyboard-shortcuts-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "keyboard-shortcuts-container";
    document.body.appendChild(container);
  }
  return container;
}

function renderToContainer() {
  const container = getOrCreateContainer();
  render(renderModal(), container);
}

/**
 * Show the keyboard shortcuts help modal
 */
export function showKeyboardShortcutsModal(): void {
  if (isOpen) return;
  isOpen = true;
  if (!isListeningForEscape) {
    document.addEventListener("keydown", handleKeydown);
    isListeningForEscape = true;
  }
  renderToContainer();
}

/**
 * Hide the keyboard shortcuts help modal
 */
export function hideKeyboardShortcutsModal(): void {
  if (!isOpen) return;
  isOpen = false;
  searchQuery = "";
  if (isListeningForEscape) {
    document.removeEventListener("keydown", handleKeydown);
    isListeningForEscape = false;
  }
  renderToContainer();
}

/**
 * Toggle the keyboard shortcuts help modal
 */
export function toggleKeyboardShortcutsModal(): void {
  if (isOpen) {
    hideKeyboardShortcutsModal();
  } else {
    showKeyboardShortcutsModal();
  }
}

/**
 * Check if the modal is currently open
 */
export function isKeyboardShortcutsModalOpen(): boolean {
  return isOpen;
}
