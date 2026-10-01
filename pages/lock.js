import { emblem, h, icon, initTheme, t, toast } from "../src/shared/dom.js";
import { getConfig, watchConfig } from "../src/shared/config.js";

initTheme();
document.addEventListener("contextmenu", (event) => event.preventDefault());

let security = (await getConfig()).security;

const remainingSeconds = () => Math.max(0, Math.ceil(((security.hard_locked_open_at ?? 0) - Date.now()) / 1000));
const isQuarantined = () => security.hard_locked && remainingSeconds() > 0;

// ---------------------------------------------------------------- DOM

const stateLabel = h("span", { class: "state" });
const errorText = h("span");
const errorBox = h("div", { class: "alert", role: "alert", hidden: true }, icon("alert"), errorText);
const input = h("input", { class: "input", type: "password", autocomplete: "off", spellcheck: "false", autofocus: true });
const eye = h("button", { class: "icon-btn", type: "button", "aria-label": t("lockShowPassword") }, icon("eye"));
const submit = h("button", { class: "btn btn-lg btn-block", type: "submit" }, t("lockUnlock"));
const root = h("div", { class: "lock" });

const dialogBody = h("p");
const dialog = h(
  "dialog",
  { class: "modal" },
  h("h2", {}, t("lockQuarantineTitle")),
  dialogBody,
  h("button", { class: "btn btn-block", type: "button", onclick: () => dialog.close() }, t("ok")),
);

root.append(
  h(
    "div",
    { class: "lock-head" },
    h("div", { class: "badge" }, emblem(56)),
    h("h1", { class: "lock-title" }, t("lockThisBrowser"), " ", stateLabel),
  ),
  h(
    "form",
    {
      class: "lock-form",
      onsubmit: (event) => {
        event.preventDefault();
        attempt();
      },
    },
    h("label", { for: "password" }, t("lockPasswordLabel")),
    h("div", { class: "password-wrap" }, Object.assign(input, { id: "password" }), eye),
    errorBox,
    submit,
  ),
  h("div", { class: "lock-foot" }, t("extName")),
);
document.body.append(root, dialog);

// ---------------------------------------------------------------- behaviour

function showError(message) {
  errorText.textContent = message ?? "";
  errorBox.hidden = message == null;
}

function render() {
  const quarantined = isQuarantined();
  root.dataset.quarantined = String(quarantined);
  stateLabel.textContent = t(quarantined ? "lockStateQuarantined" : "lockStateLocked");
  if (dialog.open) {
    if (quarantined) dialogBody.textContent = t("lockQuarantineBody", security.attempt, remainingSeconds());
    else dialog.close();
  }
}

function showQuarantineDialog() {
  dialogBody.textContent = t("lockQuarantineBody", security.attempt, remainingSeconds());
  if (!dialog.open) dialog.showModal();
}

async function attempt() {
  if (isQuarantined()) {
    showError(t("lockErrorQuarantined"));
    showQuarantineDialog();
    return;
  }
  submit.disabled = true;
  try {
    const result = await browser.runtime.sendMessage({ type: "unlock", password: input.value });
    if (result.ok) return;
    input.value = "";
    switch (result.error) {
      case "empty":
        showError(t("lockErrorEmpty"));
        break;
      case "quarantined":
        showError(t("lockErrorQuarantined"));
        break;
      case "wrong":
        showError(t("lockErrorWrong"));
        if (result.quarantined) toast("error", t("toastError"), t("lockToastQuarantined"));
        else if (result.warn) toast("warning", t("toastWarning"), t("lockToastAttempts", result.attempt, result.maxAttempts));
        break;
      default:
        toast("error", t("toastError"), t("lockErrorFailed", result.message ?? ""));
    }
    if (result.quarantined || result.error === "quarantined") {
      security = (await getConfig()).security;
      render();
      showQuarantineDialog();
    }
  } catch (error) {
    toast("error", t("toastError"), t("lockErrorFailed", error?.message ?? error));
  } finally {
    submit.disabled = false;
    input.focus();
  }
}

eye.addEventListener("click", () => {
  const reveal = input.type === "password";
  input.type = reveal ? "text" : "password";
  eye.replaceChildren(icon(reveal ? "eye-off" : "eye"));
  eye.setAttribute("aria-label", t(reveal ? "lockHidePassword" : "lockShowPassword"));
});
input.addEventListener("input", () => showError(null));

watchConfig((config) => {
  security = config.security;
  render();
});
setInterval(render, 1000);
render();
