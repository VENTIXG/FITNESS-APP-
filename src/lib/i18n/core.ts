/**
 * Tiny, typed i18n core.
 *
 * Messages are plain objects; Greek dictionaries are typed against the English
 * shape (`DeepStrings`), so a missing or extra key is a compile error.
 *
 * Template syntax (ICU subset):
 *   "Hello {name}"
 *   "{count, plural, one {# day} other {# days}}"
 */
import type { Locale } from "../domain";

export type DeepStrings<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]>;
};

/** Define a message section with English + Greek side by side. */
export function defineMessages<T extends Record<string, unknown>>(messages: { en: T; el: DeepStrings<T> }) {
  return messages;
}

const pluralRulesCache = new Map<Locale, Intl.PluralRules>();
function pluralRules(locale: Locale) {
  let r = pluralRulesCache.get(locale);
  if (!r) {
    r = new Intl.PluralRules(locale === "el" ? "el-GR" : "en-GB");
    pluralRulesCache.set(locale, r);
  }
  return r;
}

export type Params = Record<string, string | number | null | undefined>;

/** Finds the matching closing brace for the "{" at `open`. */
function matchBrace(s: string, open: number) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function formatPlural(body: string, value: number, locale: Locale): string {
  // body: " one {# day} other {# days}"
  const options = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    const keyMatch = /\s*(=\d+|zero|one|two|few|many|other)\s*\{/y;
    keyMatch.lastIndex = i;
    const m = keyMatch.exec(body);
    if (!m) break;
    const open = keyMatch.lastIndex - 1;
    const close = matchBrace(body, open);
    if (close < 0) break;
    options.set(m[1], body.slice(open + 1, close));
    i = close + 1;
  }
  const exact = options.get(`=${value}`);
  const chosen = exact ?? options.get(pluralRules(locale).select(value)) ?? options.get("other") ?? "";
  return chosen.replace(/#/g, String(value));
}

/** Interpolates `{name}` placeholders and `{n, plural, ...}` blocks. */
export function format(template: string, params: Params = {}, locale: Locale = "en"): string {
  let out = "";
  let i = 0;
  while (i < template.length) {
    const ch = template[i];
    if (ch !== "{") {
      out += ch;
      i++;
      continue;
    }
    const close = matchBrace(template, i);
    if (close < 0) {
      out += template.slice(i);
      break;
    }
    const inner = template.slice(i + 1, close);
    const pluralMatch = /^\s*(\w+)\s*,\s*plural\s*,([\s\S]*)$/.exec(inner);
    if (pluralMatch) {
      const raw = params[pluralMatch[1]];
      const n = typeof raw === "number" ? raw : Number(raw);
      out += Number.isFinite(n) ? formatPlural(pluralMatch[2], n, locale) : "";
    } else {
      const v = params[inner.trim()];
      out += v == null ? "" : String(v);
    }
    i = close + 1;
  }
  return out;
}
