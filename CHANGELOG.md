# Changelog

All notable changes are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-01

Initial release.

### Added
- Password lock: closes every window, keeps tabs, pinned tabs and tab groups, and restores them on unlock.
- Auto lock at browser start, with a choice of what opens after unlocking (previous windows, a new tab, or a page).
- Idle lock (1-60 minutes) with an optional 5-second warning notification; skipped while a tab is playing audio.
- Quarantine mode: lockout after 1-20 wrong passwords for 1-15 minutes, with optional deletion of cookies,
  passwords, downloads, form data and history.
- Quick lock shortcut (`Ctrl+M`, `Command+M` on macOS), re-bindable from the settings page; toolbar popup and
  context menu entries.
- Settings, change-password and first-run onboarding pages with light and dark themes.
- English, Spanish and Turkish translations.
