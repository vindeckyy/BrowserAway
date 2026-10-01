import { h, icon, initTheme, t } from "../src/shared/dom.js";

initTheme();

document.body.append(
  h(
    "button",
    {
      class: "btn btn-block",
      // The popup is destroyed when the lock closes its window, so the reply may never arrive.
      onclick: () => browser.runtime.sendMessage({ type: "lock" }).catch(() => {}),
    },
    icon("lock"),
    t("popupLockBrowser"),
  ),
  h(
    "button",
    {
      class: "btn btn-block btn-secondary",
      onclick: async () => {
        await browser.runtime.openOptionsPage();
        window.close();
      },
    },
    icon("sliders"),
    t("popupOpenSettings"),
  ),
);
