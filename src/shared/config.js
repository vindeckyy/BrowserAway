import { DEFAULTS } from "./defaults.js";

const SECTIONS = Object.keys(DEFAULTS);

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Deep-merges `over` onto a copy of `base`; arrays and primitives are replaced. */
export function merge(base, over) {
  if (!isPlainObject(base) || !isPlainObject(over)) return over === undefined ? structuredClone(base) : structuredClone(over);
  const out = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(over)])) {
    out[key] = key in over ? merge(base[key], over[key]) : structuredClone(base[key]);
  }
  return out;
}

/** Reads every section, filling gaps with defaults. */
export async function getConfig() {
  const stored = await browser.storage.local.get(SECTIONS);
  return Object.fromEntries(SECTIONS.map((section) => [section, merge(DEFAULTS[section], stored[section])]));
}

/** Merges `partial` into one section and persists it. Returns the new section value. */
export async function patchConfig(section, partial) {
  const stored = await browser.storage.local.get(section);
  const next = merge(merge(DEFAULTS[section], stored[section]), partial);
  await browser.storage.local.set({ [section]: next });
  return next;
}

/** Calls `callback` with a fresh full config whenever any section changes. */
export function watchConfig(callback) {
  const listener = (changes, area) => {
    if (area === "local" && SECTIONS.some((s) => s in changes)) getConfig().then(callback);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
