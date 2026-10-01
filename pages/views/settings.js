import { h, icon, t, toast } from "../../src/shared/dom.js";
import { getConfig, patchConfig } from "../../src/shared/config.js";

const COMMAND_NAME = "lock_browser_now_fixed";
const CLEAR_TYPES = ["cookies", "passwords", "downloads", "formData", "history"];
const CLEAR_TYPE_LABELS = {
  cookies: "qmCookies",
  passwords: "qmPasswords",
  downloads: "qmDownloads",
  formData: "qmFormData",
  history: "qmHistory",
};
const CLEAR_DURATIONS = [1, 7, 30, 365];

const getPath = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);

function setPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  keys.reduce((value, key) => value[key], object)[last] = value;
}

function validUrl(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return false;
  return [text, `https://${text}`].some((candidate) => {
    try {
      return ["http:", "https:", "about:"].includes(new URL(candidate).protocol);
    } catch {
      return false;
    }
  });
}

// ---------------------------------------------------------------- shortcut capture

const IS_MAC = /mac/i.test(navigator.platform);
const NAMED_KEYS = {
  Comma: "Comma",
  Period: "Period",
  Space: "Space",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  Insert: "Insert",
  Delete: "Delete",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

/** Converts a keydown event to a WebExtension command shortcut, or null for bare modifiers. */
function toShortcut(event) {
  let key = null;
  if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3);
  else if (/^Digit[0-9]$/.test(event.code)) key = event.code.slice(5);
  else if (/^F([1-9]|1[0-2])$/.test(event.code)) key = event.code;
  else key = NAMED_KEYS[event.code] ?? null;
  if (!key) return null;

  const modifiers = [];
  if (IS_MAC) {
    if (event.metaKey) modifiers.push("Command");
    if (event.ctrlKey) modifiers.push("MacCtrl");
  } else if (event.ctrlKey) {
    modifiers.push("Ctrl");
  }
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");
  return [...modifiers, key].join("+");
}

// ---------------------------------------------------------------- controls

function switchControl(checked, onChange, label) {
  const input = h("input", { type: "checkbox", checked, "aria-label": label, onchange: () => onChange(input.checked) });
  return h("label", { class: "switch" }, input, h("span", { class: "track" }));
}

function segmented(options, value, onChange) {
  const buttons = options.map((option) =>
    h(
      "button",
      {
        type: "button",
        "aria-pressed": String(option.value === value),
        onclick: () => onChange(option.value),
      },
      option.label,
    ),
  );
  return h("div", { class: "seg", role: "group" }, buttons);
}

function labelled(title, hint, control, extra = "") {
  return h(
    "div",
    { class: `field ${extra}`.trim() },
    h("span", { class: "field-label" }, title),
    hint ? h("span", { class: "hint" }, hint) : null,
    control,
  );
}

function panel({ title, help, enabled, onToggle, body, main = false }) {
  return h(
    "section",
    { class: `panel${main ? " panel-main" : ""}`, "data-active": String(enabled) },
    h(
      "div",
      { class: "panel-head" },
      h("h2", {}, title, help ? h("span", { class: "help", title: help }, icon("help", 20)) : null),
      switchControl(enabled, onToggle, title),
    ),
    enabled && body ? h("div", { class: "panel-body" }, body) : null,
  );
}

// ---------------------------------------------------------------- view

export async function renderSettings() {
  const config = await getConfig();
  const { dark: _dark, ...stored } = config.setting;
  let saved = structuredClone(stored);
  const draft = structuredClone(stored);
  let { misc } = config;

  const root = h("div", { class: "stack" });
  const content = h("div", { class: "stack" });
  const saveButton = h("button", { class: "btn btn-lg", type: "submit" }, icon("save"), t("setSave"));
  const saveBar = h("div", { class: "save-bar", hidden: true }, saveButton);
  const form = h("form", { novalidate: true, onsubmit: save }, root, saveBar);

  const updateDirty = () => {
    saveBar.hidden = JSON.stringify(draft) === JSON.stringify(saved);
  };
  const structural = () => {
    build();
    updateDirty();
  };
  const change = (path, value) => {
    setPath(draft, path, value);
    structural();
  };

  // ------------------------------------------------ panels

  function autoLockPanel() {
    const auto = draft.auto_lock;
    const urlInput = h("input", {
      class: "input",
      type: "text",
      value: auto.start_url,
      placeholder: t("pleaseInput"),
      oninput: () => {
        auto.start_url = urlInput.value;
        urlInput.removeAttribute("aria-invalid");
        updateDirty();
      },
    });
    return panel({
      title: t("alName"),
      help: t("alDescription"),
      enabled: auto.active,
      onToggle: (v) => change("auto_lock.active", v),
      body: [
        h("p", { class: "intro" }, t("alDescription")),
        labelled(
          t("alStartState"),
          t("alStartStateHint"),
          segmented(
            [
              { value: "url", label: t("alStateUrl") },
              { value: "new_tab", label: t("alStateNewTab") },
              { value: "restore", label: t("alStateRestore") },
            ],
            auto.start_state,
            (v) => change("auto_lock.start_state", v),
          ),
          auto.start_state === "url" ? "" : "wide",
        ),
        auto.start_state === "url" ? labelled(t("alStartUrl"), t("alStartUrlHint"), urlInput) : null,
      ],
    });
  }

  function quarantinePanel() {
    const q = draft.quarantine_mode;
    const durationValue = h("span", { class: "range-value" }, t("minutes", q.hard_lock_duration));
    const durationDesc = h("span", { class: "hint" }, t("qmDurationHint", q.max_attempts, q.hard_lock_duration));
    const durationLabel = h("span", { class: "field-label" }, t("qmDuration", q.hard_lock_duration));
    const duration = h("input", {
      type: "range",
      min: 1,
      max: 15,
      step: 1,
      value: q.hard_lock_duration,
      oninput: () => {
        q.hard_lock_duration = Number(duration.value);
        durationValue.textContent = t("minutes", q.hard_lock_duration);
        durationLabel.textContent = t("qmDuration", q.hard_lock_duration);
        durationDesc.textContent = t("qmDurationHint", q.max_attempts, q.hard_lock_duration);
        updateDirty();
      },
    });
    const attempts = h("input", {
      class: "input",
      type: "number",
      min: 1,
      max: 20,
      step: 1,
      value: q.max_attempts,
      oninput: () => {
        const n = Math.trunc(Number(attempts.value));
        if (!(n >= 1 && n <= 20)) return;
        q.max_attempts = n;
        durationDesc.textContent = t("qmDurationHint", q.max_attempts, q.hard_lock_duration);
        updateDirty();
      },
    });

    const clearDays = q.clear_duration;
    return panel({
      title: t("qmName"),
      help: t("qmHelp"),
      enabled: q.active,
      onToggle: (v) => change("quarantine_mode.active", v),
      body: [
        h("div", { class: "field wide" }, durationLabel, durationDesc, duration, durationValue),
        labelled(t("qmMaxAttempts"), t("qmMaxAttemptsHint"), attempts),
        labelled(
          t("qmClearHistory"),
          t("qmClearHistoryHint", q.max_attempts),
          segmented(
            [
              { value: true, label: t("clear") },
              { value: false, label: t("dontClear") },
            ],
            q.clear_history,
            async (wantClear) => {
              let value = wantClear;
              if (wantClear) {
                // Must be requested straight from the click so Firefox shows the prompt.
                const granted = await browser.permissions.request({ permissions: ["browsingData"] });
                if (!granted) {
                  value = false;
                  toast("warning", t("toastWarning"), t("qmPermissionDenied"));
                }
              }
              change("quarantine_mode.clear_history", value);
            },
          ),
        ),
        q.clear_history
          ? [
              labelled(
                t("qmClearOptionsTitle"),
                t("qmClearOptionsHint", q.max_attempts, clearDays),
                h(
                  "div",
                  { class: "checks" },
                  CLEAR_TYPES.map((type) => {
                    const box = h("input", {
                      type: "checkbox",
                      checked: q.clear_options[type],
                      onchange: () => {
                        q.clear_options[type] = box.checked;
                        updateDirty();
                      },
                    });
                    return h("label", { class: "check" }, box, t(CLEAR_TYPE_LABELS[type]));
                  }),
                ),
              ),
              labelled(
                t("qmClearDurationTitle"),
                null,
                h(
                  "select",
                  {
                    class: "input",
                    onchange: (event) => change("quarantine_mode.clear_duration", Number(event.target.value)),
                  },
                  CLEAR_DURATIONS.map((days) =>
                    h("option", { value: days, selected: days === clearDays }, t(`clearDuration${days}`)),
                  ),
                ),
              ),
              h("p", { class: "danger-note wide" }, t("qmClearDurationAlert", clearDays)),
            ]
          : null,
      ],
    });
  }

  function quickLockPanel() {
    const current = h("kbd", {}, "…");
    const status = h("span", { class: "hint" });
    const changeButton = h("button", { class: "btn btn-secondary", type: "button" }, t("qlChange"));
    const resetButton = h("button", { class: "btn btn-secondary", type: "button" }, t("qlReset"));

    const refresh = async () => {
      const command = (await browser.commands.getAll()).find((c) => c.name === COMMAND_NAME);
      current.textContent = command?.shortcut || t("qlUnassigned");
    };
    refresh();

    let stopCapture = null;
    changeButton.addEventListener("click", () => {
      if (stopCapture) return stopCapture();
      status.textContent = t("qlPressKeys");
      changeButton.textContent = t("cancel");
      const onKey = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") return stopCapture();
        const shortcut = toShortcut(event);
        if (!shortcut) return;
        stopCapture();
        try {
          await browser.commands.update({ name: COMMAND_NAME, shortcut });
        } catch {
          status.textContent = t("qlInvalid", shortcut);
        }
        refresh();
      };
      stopCapture = () => {
        window.removeEventListener("keydown", onKey, true);
        stopCapture = null;
        status.textContent = "";
        changeButton.textContent = t("qlChange");
      };
      window.addEventListener("keydown", onKey, true);
    });
    resetButton.addEventListener("click", async () => {
      await browser.commands.reset(COMMAND_NAME);
      refresh();
    });

    return panel({
      title: t("qlName"),
      help: t("qlDescription"),
      enabled: draft.short_cut_lock.active,
      onToggle: (v) => change("short_cut_lock.active", v),
      body: [
        labelled(
          t("qlCombination"),
          t("qlCombinationHint"),
          h("div", { class: "shortcut-row" }, current, changeButton, resetButton, status),
          "wide",
        ),
      ],
    });
  }

  function idlePanel() {
    const idle = draft.idle_mode;
    const label = h("span", { class: "hint" }, t("imDurationHint", idle.duration));
    const value = h("span", { class: "range-value" }, t("minutes", idle.duration));
    const slider = h("input", {
      type: "range",
      min: 1,
      max: 60,
      step: 1,
      value: idle.duration,
      oninput: () => {
        idle.duration = Number(slider.value);
        label.textContent = t("imDurationHint", idle.duration);
        value.textContent = t("minutes", idle.duration);
        updateDirty();
      },
    });
    return panel({
      title: t("imName"),
      help: t("imDescription"),
      enabled: idle.active,
      onToggle: (v) => change("idle_mode.active", v),
      body: [
        h("div", { class: "field" }, h("span", { class: "field-label" }, t("imDuration")), label, slider, value),
        labelled(
          t("imNotify"),
          null,
          segmented(
            [
              { value: true, label: t("yes") },
              { value: false, label: t("no") },
            ],
            idle.notify,
            (v) => change("idle_mode.notify", v),
          ),
        ),
      ],
    });
  }

  // ------------------------------------------------ banners

  function banners() {
    const items = [];
    if (!saved.active && !misc.do_not_notify_install) {
      items.push(
        h(
          "div",
          { class: "banner", role: "status" },
          icon("alert"),
          t("bannerInactive"),
          h(
            "button",
            {
              class: "btn btn-secondary",
              type: "button",
              onclick: async () => {
                misc = await patchConfig("misc", { do_not_notify_install: true });
                build();
              },
            },
            t("bannerDontRemind"),
          ),
        ),
      );
    }
    if (!privateAllowed) items.push(h("div", { class: "banner", role: "status" }, icon("info"), t("bannerPrivateWindows")));
    return items;
  }

  let privateAllowed = true;
  browser.extension.isAllowedIncognitoAccess().then((allowed) => {
    privateAllowed = allowed;
    build();
  });

  function build() {
    content.replaceChildren(
      panel({
        title: t("extName"),
        help: t("setMainHelp"),
        enabled: draft.active,
        main: true,
        onToggle: (v) => change("active", v),
      }),
      ...(draft.active ? [autoLockPanel(), quarantinePanel(), quickLockPanel(), idlePanel()] : []),
    );
    root.replaceChildren(...banners(), content);
  }

  // ------------------------------------------------ save

  async function save(event) {
    event.preventDefault();
    if (draft.auto_lock.start_state === "url" && !validUrl(draft.auto_lock.start_url)) {
      toast("error", t("toastError"), t("errInvalidUrl"));
      return;
    }
    try {
      await patchConfig("setting", draft);
      saved = structuredClone(draft);
      updateDirty();
      toast("success", t("toastSuccess"), t("setSaved"));
      build();
    } catch (error) {
      toast("error", t("toastError"), String(error?.message ?? error));
    }
  }

  build();
  return form;
}
