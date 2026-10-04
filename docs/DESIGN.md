# Design system

- **Tokens** live in `src/app/globals.css` (`--bg`, `--surface*`, `--fg*`, `--border*`, `--accent`, status `--good/--warn/--serious/--critical`, chart tokens). Light and dark are defined separately; dark is the default look.
- **Typography:** Inter Variable (Latin + Greek), tabular numerals for all figures.
- **Charts** follow the dataviz method: fixed categorical order (`--series-1…8`, validated for CVD separation in both themes), one y-axis only, raw points muted with the accent line for the trend, hairline grids, crosshair tooltips, and a table view on every chart. Macro colors are fixed: calories = series-1, protein = 2, carbs = 3, fat = 4, fiber = 5. Status colors are never used as series colors and always come with text/icons.
- **Mobile:** bottom tab bar (Home, Food, Workout, Progress, More), persistent "+" quick-add, bottom sheets with drag-to-dismiss, 44 px touch targets, safe-area insets, no horizontal page scroll.
- **Accessibility:** Radix focus management, labelled controls, `aria-pressed`/`role=checkbox` on toggles, reduced-motion support, color never carries meaning alone.
