import { h, icon, initTheme, t } from "../src/shared/dom.js";
import { getConfig, patchConfig, watchConfig } from "../src/shared/config.js";
import { renderOnboarding } from "./views/onboarding.js";
import { renderPassword } from "./views/password.js";
import { renderSettings } from "./views/settings.js";

const navigate = (path) => {
  location.hash = `#${path}`;
};

const ROUTES = {
  "/": { label: "navSettings", glyph: "sliders", render: () => renderSettings() },
  "/password": { label: "navPassword", glyph: "key", render: () => renderPassword({ navigate }) },
};
const currentRoute = () => (location.hash.slice(1) in ROUTES ? location.hash.slice(1) : "/");

document.title = t("extName");
initTheme();

// ---------------------------------------------------------------- chrome

const themeButton = h("button", { class: "icon-btn", type: "button", "aria-label": t("navToggleTheme") });
themeButton.addEventListener("click", async () => {
  const { setting } = await getConfig();
  await patchConfig("setting", { dark: !setting.dark });
});
const syncThemeButton = ({ setting }) => themeButton.replaceChildren(icon(setting.dark ? "sun" : "moon", 22));

const topbar = h("header", { class: "topbar" }, h("div", { class: "brand" }, "Browser", h("span", {}, "Away")), themeButton);
const stage = h("div");
document.getElementById("app").append(topbar, stage);

// ---------------------------------------------------------------- routing

let rendering = 0;

async function render() {
  const ticket = ++rendering;
  const config = await getConfig();
  syncThemeButton(config);

  if (!config.misc.registered) {
    topbar.hidden = true;
    stage.replaceChildren(renderOnboarding({ onDone: render }));
    return;
  }

  const route = currentRoute();
  const view = await ROUTES[route].render();
  if (ticket !== rendering) return;

  topbar.hidden = false;
  const nav = h(
    "nav",
    { class: "nav" },
    Object.entries(ROUTES).map(([path, { label, glyph }]) =>
      h("a", { href: `#${path}`, ...(path === route ? { "aria-current": "page" } : {}) }, icon(glyph), t(label)),
    ),
  );
  stage.replaceChildren(h("div", { class: "shell" }, nav, h("main", { class: "view" }, view)));
}

watchConfig(syncThemeButton);
window.addEventListener("hashchange", render);
render();
