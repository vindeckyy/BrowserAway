// Lock engine: owns every transition of the "locked" state.
//
// Lock state lives in storage.session so it survives the event page being
// suspended. All transitions run through a single queue; event handlers call
// `whenIdle()` before reading state so they never observe a half-finished
// lock or unlock.

import { DEFAULT_LOCK_STATE } from "./shared/defaults.js";
import { getConfig, patchConfig } from "./shared/config.js";
import { verifyPassword } from "./shared/password.js";

const LOCK_WINDOW = { width: 712, height: 616 };
const ICON = "icons/icon-128.png";
const NOTIFICATION_ACTIVATE = "browseraway-activate";
const NOTIFICATION_LOCKED = "browseraway-locked-window";

// ---------------------------------------------------------------- state

export async function getLockState() {
  const { lock } = await browser.storage.session.get("lock");
  return { ...structuredClone(DEFAULT_LOCK_STATE), ...lock };
}

async function patchLockState(partial) {
  const next = { ...(await getLockState()), ...partial };
  await browser.storage.session.set({ lock: next });
  return next;
}

// ---------------------------------------------------------------- queue

let queue = Promise.resolve();

function enqueue(task) {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

/** Resolves once every queued lock/unlock transition has finished. */
export const whenIdle = () => queue;

// ---------------------------------------------------------------- notifications

export function notify(id, title, message) {
  return browser.notifications.create(id, {
    type: "basic",
    iconUrl: browser.runtime.getURL(ICON),
    title,
    message,
  });
}

export const isActivateNotification = (id) => id === NOTIFICATION_ACTIVATE;

export function notifyActivate() {
  return notify(NOTIFICATION_ACTIVATE, browser.i18n.getMessage("notifActivateTitle"), browser.i18n.getMessage("notifActivateBody"));
}

export function notifyBrowserLocked() {
  return notify(NOTIFICATION_LOCKED, browser.i18n.getMessage("extName"), browser.i18n.getMessage("notifLockedNewWindow"));
}

// ---------------------------------------------------------------- windows

async function snapshotWindows() {
  const windows = await browser.windows.getAll({ populate: true });
  const groups = browser.tabGroups ? await browser.tabGroups.query({}) : [];
  return windows
    .filter((w) => w.type === "normal")
    .map((w) => {
      const tabs = (w.tabs ?? []).map((tab) => ({
        url: tab.url,
        pinned: tab.pinned,
        active: tab.active,
        groupId: tab.groupId ?? -1,
      }));
      const usedGroups = new Set(tabs.map((tab) => tab.groupId).filter((id) => id !== -1));
      return {
        incognito: w.incognito,
        state: w.state,
        left: w.left,
        top: w.top,
        width: w.width,
        height: w.height,
        tabs,
        groups: groups
          .filter((g) => usedGroups.has(g.id))
          .map(({ id, title, color, collapsed }) => ({ id, title, color, collapsed })),
      };
    });
}

async function closeWindows(windows, keepId) {
  await Promise.all(
    windows.filter((w) => w.id !== keepId).map((w) => browser.windows.remove(w.id).catch(() => {})),
  );
}

async function windowExists(id) {
  if (id == null) return false;
  try {
    await browser.windows.get(id);
    return true;
  } catch {
    return false;
  }
}

async function openLockWindow() {
  return browser.windows.create({
    focused: true,
    type: "popup",
    url: browser.runtime.getURL("pages/lock.html"),
    ...LOCK_WINDOW,
  });
}

/** Creates a window from a snapshot. Tabs Firefox refuses to open (about: pages) are skipped. */
async function restoreWindow(snapshot) {
  const options = { incognito: snapshot.incognito };
  if (snapshot.state === "maximized" || snapshot.state === "fullscreen") {
    options.state = snapshot.state;
  } else if (snapshot.state === "normal") {
    Object.assign(options, { left: snapshot.left, top: snapshot.top, width: snapshot.width, height: snapshot.height });
  }
  const win = await browser.windows.create(options);
  const placeholderId = win.tabs?.[0]?.id;

  const createdByGroup = new Map();
  let created = 0;
  for (const tab of snapshot.tabs) {
    try {
      const { id } = await browser.tabs.create({
        windowId: win.id,
        url: tab.url,
        pinned: tab.pinned,
        active: tab.active,
      });
      created++;
      if (tab.groupId !== -1) createdByGroup.set(tab.groupId, [...(createdByGroup.get(tab.groupId) ?? []), id]);
    } catch (error) {
      console.warn("BrowserAway: could not restore tab", tab.url, error);
    }
  }
  if (created > 0 && placeholderId != null) await browser.tabs.remove(placeholderId).catch(() => {});

  if (browser.tabs.group) {
    for (const [oldId, tabIds] of createdByGroup) {
      try {
        const groupId = await browser.tabs.group({ tabIds, createProperties: { windowId: win.id } });
        const meta = snapshot.groups.find((g) => g.id === oldId);
        if (meta) await browser.tabGroups.update(groupId, { title: meta.title, color: meta.color, collapsed: meta.collapsed });
      } catch (error) {
        console.warn("BrowserAway: could not restore tab group", error);
      }
    }
  }
  return win;
}

function normalizeUrl(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  for (const candidate of [text, `https://${text}`]) {
    try {
      const url = new URL(candidate);
      if (["http:", "https:", "about:"].includes(url.protocol)) return url.href;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

/** Re-opens the user's browser after an unlock according to their auto-lock preference. */
async function reopenBrowser(lock, setting) {
  const { start_state: state, start_url: startUrl } = setting.auto_lock;
  let opened = 0;
  if (lock.locked_reason === "auto" && (state === "new_tab" || state === "url")) {
    const url = state === "url" ? normalizeUrl(startUrl) : null;
    await browser.windows.create(url ? { url } : {});
    opened = 1;
  } else {
    for (const snapshot of lock.stored_windows) {
      try {
        await restoreWindow(snapshot);
        opened++;
      } catch (error) {
        console.warn("BrowserAway: could not restore window", error);
      }
    }
  }
  // Closing the lock screen with no other window open would quit the browser.
  if (opened === 0) await browser.windows.create({});
}

// ---------------------------------------------------------------- lock

export function lockBrowser(reason) {
  return enqueue(() => doLock(reason));
}

async function doLock(reason) {
  const [config, lock] = await Promise.all([getConfig(), getLockState()]);

  if (lock.locked) {
    // Already locked: only repair a lock screen that has gone missing.
    if (await windowExists(lock.popup)) return;
    await openLockScreen(lock.stored_windows);
    return;
  }
  if (!config.setting.active || !config.security.browser_password) {
    if (reason !== "auto") notifyActivate();
    return;
  }
  if (reason === "auto" && (lock.auto_locked || !config.setting.auto_lock.active)) return;

  const stored = await snapshotWindows();
  await patchLockState({
    locked: true,
    auto_locked: true,
    locked_reason: reason,
    locked_at: Date.now(),
    stored_windows: stored,
    popup: null,
  });
  try {
    await openLockScreen(stored);
  } catch (error) {
    await patchLockState({ locked: false, stored_windows: [] });
    throw error;
  }
}

async function openLockScreen(stored) {
  const popup = await openLockWindow();
  await patchLockState({ popup: popup.id, stored_windows: stored });
  const all = await browser.windows.getAll();
  await closeWindows(all, popup.id);
}

/** Makes sure a lock screen exists while locked; returns its window id. */
export function ensureLockScreen() {
  return enqueue(async () => {
    const lock = await getLockState();
    if (!lock.locked) return null;
    if (await windowExists(lock.popup)) return lock.popup;
    await openLockScreen(lock.stored_windows);
    return (await getLockState()).popup;
  });
}

// ---------------------------------------------------------------- unlock

function unlockBrowser() {
  return enqueue(async () => {
    const [config, lock] = await Promise.all([getConfig(), getLockState()]);
    if (!lock.locked) throw new Error("Browser is not locked");
    await patchLockState({ locked: false, unlocked_at: Date.now() });
    await reopenBrowser(lock, config.setting);
    await patchLockState({ popup: null, stored_windows: [] });
    if (lock.popup != null) await browser.windows.remove(lock.popup).catch(() => {});
  });
}

async function clearBrowsingData(quarantine) {
  if (!quarantine.clear_history || !(quarantine.clear_duration > 0)) return;
  try {
    if (!(await browser.permissions.contains({ permissions: ["browsingData"] }))) return;
    const since = Date.now() - quarantine.clear_duration * 86_400_000;
    await browser.browsingData.remove({ since }, quarantine.clear_options);
  } catch (error) {
    console.error("BrowserAway: clearing browsing data failed", error);
  }
}

/**
 * Checks a password typed on the lock screen and unlocks on success.
 * Resolves to { ok: true } or { ok: false, error, ... } describing why not.
 */
export async function attemptUnlock(password) {
  const { setting, security } = await getConfig();
  const quarantine = setting.quarantine_mode;
  const now = Date.now();

  if (security.hard_locked) {
    if (now < security.hard_locked_open_at) return { ok: false, error: "quarantined" };
    await patchConfig("security", { hard_locked: false, hard_locked_at: null, hard_locked_open_at: null, attempt: 0 });
    security.attempt = 0;
  }
  if (!password) return { ok: false, error: "empty" };

  if (!(await verifyPassword(password, security.browser_password))) {
    const attempt = security.attempt + 1;
    const armed = quarantine.active && quarantine.max_attempts > 0 && quarantine.hard_lock_duration > 0;
    if (armed && attempt >= quarantine.max_attempts) {
      await patchConfig("security", {
        attempt,
        hard_locked: true,
        hard_locked_at: now,
        hard_locked_open_at: now + quarantine.hard_lock_duration * 60_000,
      });
      await clearBrowsingData(quarantine);
      return { ok: false, error: "wrong", quarantined: true, attempt, maxAttempts: quarantine.max_attempts };
    }
    await patchConfig("security", { attempt });
    return { ok: false, error: "wrong", quarantined: false, warn: armed, attempt, maxAttempts: quarantine.max_attempts };
  }

  await patchConfig("security", { attempt: 0, hard_locked: false, hard_locked_at: null, hard_locked_open_at: null });
  try {
    await unlockBrowser();
  } catch (error) {
    return { ok: false, error: "failed", message: String(error?.message ?? error) };
  }
  return { ok: true };
}
