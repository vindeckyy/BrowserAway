// BrowserAway event page. Listeners are registered synchronously at load so the
// browser can wake this page for any of these events.

import { getConfig, patchConfig } from "./shared/config.js";
import { t as msg } from "./shared/dom.js";
import {
  attemptUnlock,
  ensureLockScreen,
  getLockState,
  isActivateNotification,
  lockBrowser,
  notify,
  notifyActivate,
  notifyBrowserLocked,
  whenIdle,
} from "./lock.js";

const IDLE_NOTIFICATION = "browseraway-idle";
const IDLE_GRACE_SECONDS = 5;

const logFailure = (what) => (error) => console.error(`BrowserAway: ${what} failed`, error);

// ---------------------------------------------------------------- context menu

const MENU_LOCK_NOW = "lock_now";
const MENU_SETTINGS = "settings";

async function registerMenus() {
  await browser.menus.removeAll();
  browser.menus.create({ id: "first_menu", title: msg("extName"), contexts: ["all"] });
  browser.menus.create({ id: "lock_menu", parentId: "first_menu", title: msg("menuLockBrowser"), contexts: ["all"] });
  browser.menus.create({ id: MENU_LOCK_NOW, parentId: "lock_menu", title: msg("menuLockNow"), contexts: ["all"] });
  browser.menus.create({ id: MENU_SETTINGS, parentId: "first_menu", title: msg("menuOpenSettings"), contexts: ["all"] });
}

browser.menus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_SETTINGS) browser.runtime.openOptionsPage().catch(logFailure("open settings"));
  else if (info.menuItemId === MENU_LOCK_NOW) lockBrowser("manual").catch(logFailure("lock"));
});

// ---------------------------------------------------------------- keyboard shortcut

browser.commands.onCommand.addListener(async (command) => {
  if (command !== "lock_browser_now_fixed") return;
  const { setting } = await getConfig();
  if (setting.short_cut_lock.active) await lockBrowser("manual").catch(logFailure("lock"));
});

// ---------------------------------------------------------------- idle mode

let idleTimer = null;

async function applyIdleInterval() {
  const { setting } = await getConfig();
  browser.idle.setDetectionInterval(Math.max(15, Math.round((setting.idle_mode.duration || 1) * 60)));
}

function cancelIdleLock() {
  if (idleTimer === null) return;
  clearTimeout(idleTimer);
  idleTimer = null;
  browser.notifications.clear(IDLE_NOTIFICATION);
}

async function onIdle() {
  const { setting } = await getConfig();
  if (!setting.active || !setting.idle_mode.active) return;
  if ((await getLockState()).locked) return;
  // Don't lock someone who is watching a video or listening to music.
  if ((await browser.tabs.query({ audible: true })).length > 0) return;

  cancelIdleLock();
  if (setting.idle_mode.notify) {
    notify(IDLE_NOTIFICATION, msg("notifIdleTitle", IDLE_GRACE_SECONDS), msg("notifIdleBody"));
  }
  idleTimer = setTimeout(() => {
    idleTimer = null;
    lockBrowser("idle").catch(logFailure("idle lock"));
  }, IDLE_GRACE_SECONDS * 1000);
}

browser.idle.onStateChanged.addListener((state) => {
  if (state === "idle") onIdle().catch(logFailure("idle handling"));
  else if (state === "active") cancelIdleLock();
});

applyIdleInterval().catch(logFailure("idle setup"));
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.setting) applyIdleInterval().catch(logFailure("idle setup"));
});

// ---------------------------------------------------------------- locked-state guards

browser.tabs.onCreated.addListener(async (tab) => {
  try {
    await whenIdle();
    if (!(await getLockState()).locked) return;
    const lockWindow = await ensureLockScreen();
    if (lockWindow !== tab.windowId) await browser.tabs.remove(tab.id).catch(() => {});
  } catch (error) {
    logFailure("tab guard")(error);
  }
});

browser.windows.onCreated.addListener(async (win) => {
  try {
    await whenIdle();
    const lock = await getLockState();
    if (lock.locked) {
      if (win.id !== lock.popup && win.id > -1) notifyBrowserLocked();
    } else if (!lock.auto_locked) {
      await lockBrowser("auto");
    }
  } catch (error) {
    logFailure("window guard")(error);
  }
});

browser.windows.onRemoved.addListener(async (windowId) => {
  try {
    await whenIdle();
    const lock = await getLockState();
    if (lock.locked) {
      if (windowId === lock.popup) await browser.storage.session.set({ lock: { ...lock, popup: null } });
    } else if ((await browser.windows.getAll()).length === 0) {
      // Browser is empty (macOS keeps running): the next window starts a new session.
      await browser.storage.session.set({ lock: { ...lock, auto_locked: false } });
    }
  } catch (error) {
    logFailure("window cleanup")(error);
  }
});

// ---------------------------------------------------------------- notifications

browser.notifications.onClicked.addListener((id) => {
  if (isActivateNotification(id)) browser.runtime.openOptionsPage().catch(logFailure("open settings"));
});

// ---------------------------------------------------------------- messages from extension pages

browser.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== browser.runtime.id) return undefined;
  switch (message?.type) {
    case "lock":
      return lockBrowser("manual").then(() => ({ ok: true }));
    case "unlock":
      return attemptUnlock(String(message.password ?? ""));
    default:
      return undefined;
  }
});

// ---------------------------------------------------------------- lifecycle

browser.runtime.onInstalled.addListener(async ({ reason }) => {
  await registerMenus();
  if (reason === "install") await browser.runtime.openOptionsPage();
});

browser.runtime.onStartup.addListener(async () => {
  try {
    await registerMenus();
    const { setting, misc } = await getConfig();
    if (!setting.active) {
      if (!misc.do_not_notify_install) await notifyActivate();
      return;
    }
    await lockBrowser("auto");
  } catch (error) {
    logFailure("startup")(error);
  }
});
