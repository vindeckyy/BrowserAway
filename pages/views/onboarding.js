import { emblem, h, icon, t, toast } from "../../src/shared/dom.js";
import { patchConfig } from "../../src/shared/config.js";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../../src/shared/password.js";

/** First-run flow: welcome, then choose the browser password and switch protection on. */
export function renderOnboarding({ onDone }) {
  const root = h("div", { class: "onboarding" });
  showWelcome();
  return root;

  function steps(current) {
    const labels = [t("obStepWelcome"), t("obStepPassword")];
    return h(
      "div",
      { class: "steps" },
      labels.map((label, i) => h("span", i === current ? { "aria-current": "step" } : {}, label)),
    );
  }

  function showWelcome() {
    root.replaceChildren(
      steps(0),
      h("div", { class: "badge-large" }, emblem(88)),
      h("h1", {}, t("obWelcomeTitle")),
      h("p", { class: "lead" }, t("obWelcomeBody")),
      h("button", { class: "btn btn-lg", onclick: showPassword }, icon("key"), t("obStart")),
    );
  }

  function showPassword() {
    const password = h("input", { class: "input", type: "password", autocomplete: "new-password" });
    const again = h("input", { class: "input", type: "password", autocomplete: "new-password" });
    const passwordError = h("span", { class: "field-error" });
    const againError = h("span", { class: "field-error" });

    const form = h(
      "form",
      {
        class: "card",
        novalidate: true,
        onsubmit: async (event) => {
          event.preventDefault();
          passwordError.textContent = againError.textContent = "";
          password.removeAttribute("aria-invalid");
          again.removeAttribute("aria-invalid");
          if (password.value.length < MIN_PASSWORD_LENGTH) {
            passwordError.textContent = t("errPasswordShort", MIN_PASSWORD_LENGTH);
            password.setAttribute("aria-invalid", "true");
            return;
          }
          if (password.value !== again.value) {
            againError.textContent = t("errPasswordMismatch");
            again.setAttribute("aria-invalid", "true");
            return;
          }
          try {
            await patchConfig("security", { browser_password: await hashPassword(password.value), attempt: 0 });
            await patchConfig("setting", { active: true });
            await patchConfig("misc", { registered: true });
            onDone();
          } catch (error) {
            toast("error", t("toastError"), String(error?.message ?? error));
          }
        },
      },
      h("h1", {}, t("obPasswordTitle")),
      h("p", { class: "lead" }, t("obPasswordBody")),
      h("div", { class: "field" }, h("label", {}, t("obPassword")), password, passwordError),
      h("div", { class: "field" }, h("label", {}, t("obPasswordAgain")), again, againError),
      h(
        "div",
        { class: "row-buttons" },
        h("button", { class: "btn btn-lg btn-secondary", type: "button", onclick: showWelcome }, t("back")),
        h("button", { class: "btn btn-lg", type: "submit" }, icon("lock"), t("obFinish")),
      ),
    );
    root.replaceChildren(steps(1), form);
    password.focus();
  }
}
