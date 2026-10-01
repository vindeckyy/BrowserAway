// Fails when a locale is missing a key, has an extra key, or uses different $N placeholders than English.
import { readFileSync, readdirSync } from "node:fs";

const load = (lang) => JSON.parse(readFileSync(`_locales/${lang}/messages.json`, "utf8"));
const placeholders = (text) => [...new Set(text.match(/\$\d/g) ?? [])].sort().join(",");

const base = load("en");
let failed = false;
const fail = (message) => {
  failed = true;
  console.error(message);
};

for (const lang of readdirSync("_locales")) {
  if (lang === "en") continue;
  const messages = load(lang);
  for (const key of Object.keys(base)) {
    if (!(key in messages)) fail(`${lang}: missing key ${key}`);
    else if (placeholders(messages[key].message) !== placeholders(base[key].message)) fail(`${lang}: placeholders differ for ${key}`);
  }
  for (const key of Object.keys(messages)) if (!(key in base)) fail(`${lang}: unknown key ${key}`);
}

if (failed) process.exit(1);
console.log("locales OK");
