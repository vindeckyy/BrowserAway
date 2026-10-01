# Architecture

BrowserAway is a Manifest V3 Firefox extension with a non-persistent **event page** and no build step.

```
manifest.json            permissions, commands, popup, options page
src/background.js        event listeners; registered synchronously so the event page can be woken for any of them
src/lock.js              the lock engine: every lock/unlock transition, quarantine, window snapshot/restore
src/shared/defaults.js   default settings and default lock state
src/shared/config.js     read / patch / watch helpers over storage.local
src/shared/password.js   PBKDF2-SHA-256 hashing and verification (Web Crypto)
src/shared/dom.js        h() element builder, inline SVG icons, theme and toast helpers, i18n shortcut
pages/lock.*             the lock screen shown in the popup window
pages/popup.*            toolbar popup (Lock Browser, Open Settings)
pages/options.*          hash-routed settings app; pages/views/{settings,password,onboarding}.js
_locales/{en,es,tr}      browser.i18n catalogues
```

## State

| Where | Key | Contents |
| --- | --- | --- |
| `storage.local` | `setting` | user preferences (auto lock, idle, quarantine, shortcut toggle, dark theme, master switch) |
| `storage.local` | `security` | attempt counter, quarantine timestamps, password record |
| `storage.local` | `misc` | onboarding completed, "don't remind me again" |
| `storage.session` | `lock` | `locked`, reason, lock screen window id, snapshot of the closed windows |

Each section has its own storage key, so a write to one section cannot overwrite a concurrent write to another.
Lock state lives in `storage.session`, which survives the event page being suspended but is cleared when the browser
closes.

## Lock flow

1. A trigger (toolbar popup, context menu, shortcut, idle timer, browser start, new window) calls
   `lockBrowser(reason)`. A lock needs the master switch on **and** a password set, otherwise the user is pointed to
   the settings page.
2. `doLock` snapshots every window (geometry, tabs, pinned state, tab groups), stores it in `storage.session`, opens
   the 712×616 lock-screen popup, then closes all other windows.
3. While locked, `tabs.onCreated` removes any new tab outside the lock window and `windows.onCreated` shows a
   "browser is locked" notification. If the lock window disappears it is recreated.
4. The lock page sends `{ type: "unlock", password }` to the background page, which verifies the password
   (`attemptUnlock`). The password check lives in the background page, not in the lock page.
5. On success the browser is reopened: after an *auto* lock with start state `new_tab` or `url` a fresh window is
   opened and the snapshot discarded; otherwise the windows are restored from the snapshot. The lock window is then
   closed.

All transitions run through one promise queue (`enqueue` in `src/lock.js`), and event handlers `await whenIdle()`
before reading state, so they never observe a half-finished lock or unlock.

## Quarantine

Each wrong password increments `security.attempt`. When it reaches `max_attempts` and quarantine is enabled,
`hard_locked_open_at` is set to *now + duration* (milliseconds since epoch) and the optional browsing-data clear
runs. While `now < hard_locked_open_at` every attempt is refused, including the correct password. The countdown is
timestamp-based, so it continues across restarts; the counters are reset lazily on the first attempt after expiry.

Clearing browsing data uses the optional `browsingData` permission, requested from the settings page when the user
turns the option on.

## Idle lock

`idle.setDetectionInterval(duration * 60)` is re-applied whenever settings change. On `idle` the extension skips
locking if any tab is audible, optionally notifies, and locks after 5 seconds unless the state returns to `active`.

## Security notes

- Passwords are stored as `PBKDF2-HMAC-SHA-256`, 310 000 iterations, 16-byte random salt. The plain text is never
  stored.
- The lock is enforced by the extension inside a running browser. It does not protect the profile on disk: someone
  with file access can read `storage.local`, remove the extension, or start another profile.
- Private windows are only covered if the user allows the add-on to run in private windows.
- `storage.session` is in memory. Quitting Firefox while locked ends the lock; with *Auto lock* enabled the next
  start locks again, but the windows that were closed by the lock are not restored.
- The extension makes no network requests.
