# Contributing

Thanks for helping. The extension has no build step: the repository root *is* the extension.

## Setup

```sh
npm install        # installs web-ext
npm run lint       # static validation of manifest and sources
npm run start      # opens Firefox with the extension loaded and auto-reloads on changes
npm run build      # produces web-ext-artifacts/browseraway-<version>.zip
```

Requires Firefox 140 or newer and Node.js 20 or newer.

## Guidelines

- Plain ES modules and the `browser.*` promise APIs; no frameworks or bundlers.
- Keep it offline: the extension makes no network requests, and changes must not add any.
- Every user-visible string goes through `browser.i18n` (`_locales/*/messages.json`). Add the key to **all** locales
  and keep the `$1`, `$2` placeholders identical across them.
- Build DOM with the helpers in `src/shared/dom.js`; never assign to `innerHTML`.
- Lock/unlock state transitions belong in `src/lock.js` and must go through its queue.
- Update [CHANGELOG.md](CHANGELOG.md) for user-visible changes.

## Testing

There is no automated suite yet. Before opening a pull request, load the extension and walk through: onboarding →
change settings and press **Apply Changes** → lock → wrong password until quarantine → unlock → confirm windows are
restored. `npm run lint` must report no errors.

## Pull requests

Keep changes focused, describe the behaviour change, and mention how you tested it.
