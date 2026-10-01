// Default values for everything BrowserAway persists in storage.local.
// Each top-level key is stored under its own storage key so a write to one
// section can never clobber a concurrent write to another.

export const DEFAULTS = Object.freeze({
  // User-editable preferences.
  setting: {
    dark: false,
    active: false,
    auto_lock: {
      active: true,
      // "restore" | "new_tab" | "url"
      start_state: "restore",
      start_url: "https://www.mozilla.org",
    },
    idle_mode: { active: false, duration: 6, notify: true },
    short_cut_lock: { active: true },
    quarantine_mode: {
      active: true,
      hard_lock_duration: 1,
      max_attempts: 5,
      clear_history: false,
      clear_options: { cookies: false, passwords: false, downloads: false, formData: false, history: false },
      clear_duration: 1,
    },
  },
  // Password record and brute-force counters. Written by the background page
  // (attempts, quarantine) and by the options page (password changes).
  security: {
    attempt: 0,
    hard_locked: false,
    hard_locked_at: null,
    hard_locked_open_at: null,
    // { hash, salt, iterations, changed_at } once a password has been set.
    browser_password: null,
  },
  misc: { do_not_notify_install: false, registered: false },
});

// Volatile lock state, kept in storage.session (cleared when the browser closes).
export const DEFAULT_LOCK_STATE = Object.freeze({
  locked: false,
  // True once the browser has been auto-locked in this session.
  auto_locked: false,
  locked_reason: null,
  locked_at: null,
  unlocked_at: null,
  // Window id of the lock screen while locked.
  popup: null,
  // Snapshot of the windows that were closed by the lock.
  stored_windows: [],
});
