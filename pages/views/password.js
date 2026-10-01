import { h, icon, t, toast } from "../../src/shared/dom.js";
import { getConfig, patchConfig } from "../../src/shared/config.js";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "../../src/shared/password.js";

export function renderPassword({ navigate }) {
  const fields = ["old", "next", "again"].map((name) => ({
    name,
    input: h("input", { class: "input", type: "password", autocomplete: name === "old" ? "current-password" : "new-password" }),
    error: h("span", { class: "field-error" }),
  }));
  const [old, next, again] = fields;

  const field = (f, label, hint) =>
    h("div", { class: "field" }, h("label", {}, label), f.input, h("span", { class: "hint" }, hint), f.error);

  function fail(f, message) {
    f.error.textContent = message;
    f.input.setAttribute("aria-invalid", "true");
    f.input.focus();
  }

  async function submit(event) {
    event.preventDefault();
    for (const f of fields) {
      f.error.textContent = "";
      f.input.removeAttribute("aria-invalid");
    }
    const { security } = await getConfig();
    if (!(await verifyPassword(old.input.value, security.browser_password))) return fail(old, t("errOldWrong"));
    if (next.input.value.length < MIN_PASSWORD_LENGTH) return fail(next, t("errPasswordShort", MIN_PASSWORD_LENGTH));
    if (next.input.value === old.input.value) return fail(next, t("errPasswordSame"));
    if (next.input.value !== again.input.value) return fail(again, t("errPasswordMismatch"));

    try {
      await patchConfig("security", { browser_password: await hashPassword(next.input.value) });
      toast("success", t("toastSuccess"), t("pwChanged"));
      navigate("/");
    } catch (error) {
      toast("error", t("toastError"), String(error?.message ?? error));
    }
  }

  return h(
    "form",
    { class: "card", novalidate: true, onsubmit: submit },
    h("div", { class: "avatar" }, icon("key", 30)),
    h("h1", {}, t("pwTitle")),
    h("p", { class: "lead" }, t("pwDescription")),
    field(old, t("pwOld"), t("pwOldHint")),
    field(next, t("pwNew"), t("pwNewHint")),
    field(again, t("pwAgain"), t("pwAgainHint")),
    h("button", { class: "btn btn-lg btn-block", type: "submit" }, icon("save"), t("pwSave")),
  );
}
