# BrowserAway

[![CI](https://github.com/vindeckyy/BrowserAway/actions/workflows/ci.yml/badge.svg)](https://github.com/vindeckyy/BrowserAway/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Lock Firefox with a password. When the browser is locked every window is closed and a single lock screen is shown;
the right password brings your windows back exactly as they were.

BrowserAway is a Firefox (Manifest V3) extension inspired by the Chrome extension
[Browser Lock](https://chromewebstore.google.com/detail/browser-lock-lock-your-br/nldijlfmoepgjkjhmdiiainkjgmpdnmj).
It is an independent, from-scratch implementation and is not affiliated with or endorsed by its authors. It works
fully offline: **no accounts, no servers, no telemetry.**

## Features

- **Lock / unlock** – closes every window, remembering tabs, pinned tabs, tab groups and window geometry, and
  restores them on unlock.
- **Auto lock** – locks when the browser starts. After unlocking, restore the previous windows, open a new tab, or
  open a page of your choice.
- **Idle lock** – locks after 1–60 minutes without keyboard or mouse input, with an optional 5-second warning
  notification. Never fires while a tab is playing audio.
- **Quarantine mode** – after 1–20 wrong passwords the lock screen refuses all input for 1–15 minutes (even the
  correct password) and can optionally delete cookies, saved passwords, downloads, form data and/or history from the
  last 1 / 7 / 30 / 365 days.
- **Quick lock** – `Ctrl+M` (`Command+M` on macOS), re-bindable from the settings page; also in the toolbar popup and
  the right-click menu (*BrowserAway → Lock Browser → Lock Now*).
- Light and dark theme; English, Spanish and Turkish.

## Install

Requires Firefox 140 or newer (or a fork based on it, e.g. Floorp 12.19).

Firefox release builds only run **signed** add-ons, so pick one:

| Method | Persistent | Notes |
| --- | --- | --- |
| Temporary load: `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on…* → pick `manifest.json` | no (removed on restart) | works in every Firefox, good for trying it out |
| Sign it on [addons.mozilla.org](https://addons.mozilla.org/developers/) as *unlisted*, install the signed `.xpi` | yes | recommended for daily use on regular Firefox |
| Firefox ESR / Developer Edition / Nightly: set `xpinstall.signatures.required` to `false` in `about:config`, then open the built zip | yes | unsigned installs are not allowed on regular release builds |

Build the zip with `npm install && npm run build` (output in `web-ext-artifacts/`), or download it from
[Releases](https://github.com/vindeckyy/BrowserAway/releases).

After installing, the settings page opens (or open it from the toolbar popup). Pick a password of at least 6
characters and BrowserAway is active.

To also lock **private windows**, allow the add-on to run in them: `about:addons` → BrowserAway → *Run in Private
Windows*. The settings page warns while this is off.

## Usage

| Action | How |
| --- | --- |
| Lock now | toolbar popup → *Lock Browser*, right-click → *BrowserAway → Lock Browser → Lock Now*, or the shortcut |
| Change settings | toolbar popup → *Open Settings*; edits show an **Apply Changes** button |
| Change password | settings page → *Change Password* |
| Change the shortcut | settings → *Quick Lock* → *Change*, then press the new keys (`Esc` cancels) |

> **There is no password recovery.** The original's e-mail recovery needs a server. If you forget the password,
> remove and reinstall the add-on (this resets all settings).

## Privacy

BrowserAway makes no network requests and sends nothing anywhere. Settings and the password hash are stored locally
in the browser profile (`storage.local`). Permissions used: `tabs`, `storage`, `menus`, `idle`, `notifications`,
`tabGroups`, and the optional `browsingData` (only requested if you enable data clearing on quarantine).

## Limits

BrowserAway is a convenience lock for an unattended, running browser. It does not protect the profile on disk or
resist someone who controls the machine. See [SECURITY.md](SECURITY.md) and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#security-notes).

## Differences from the Chrome original

- Removed the server-backed features: e-mail verification, forgot-password / one-time codes, contact form, remote
  announcements, and install/update/uninstall tracking.
- No name/surname/e-mail sign-up; onboarding only asks for a password.
- No *run in background* option (Firefox has no equivalent of Chrome's `background` permission).
- Passwords are stored with salted PBKDF2-SHA-256 (310 000 iterations) instead of an unsalted SHA-256 hash.
- Firefox cannot show notification buttons: the "not active yet" notification opens the settings page when clicked,
  and "don't remind me again" is a button on the settings page.
- The quarantine countdown is timestamp-based and survives a browser restart.

## Development

```sh
npm install
npm run lint     # web-ext lint
npm run start    # run in a throwaway Firefox profile with live reload
npm run build    # package into web-ext-artifacts/
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Release notes are in
[CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
