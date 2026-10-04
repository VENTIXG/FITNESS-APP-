import type { Locale } from "../domain";
import { format, type Params } from "./core";
import { auth, common, errors, nav } from "./messages/common";
import { enums } from "./messages/enums";
import { features } from "./messages/features";
import { nutrition } from "./messages/nutrition";
import { training } from "./messages/training";
import { settingsMessages } from "./messages/settings";

const en = {
  common: common.en,
  nav: nav.en,
  errors: errors.en,
  auth: auth.en,
  enums: enums.en,
  ...features.en,
  nutrition: nutrition.en,
  training: training.en,
  ...settingsMessages.en,
};

export type Dictionary = typeof en;

const el: Dictionary = {
  common: common.el,
  nav: nav.el,
  errors: errors.el,
  auth: auth.el,
  enums: enums.el,
  ...features.el,
  nutrition: nutrition.el,
  training: training.el,
  ...settingsMessages.el,
};

export const dictionaries: Record<Locale, Dictionary> = { en, el };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en;
}

export { format };
export type { Params };
