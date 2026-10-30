---
name: add-chart-type
description: Steps to add a new chart type to Vantage end to end — Zod spec, option builder in @vantage/charts following the dataviz rules, builder UI fields, tests and a visual check. Use when someone asks for a new visualization (scatter, heatmap, funnel, combo, …).
---

# Add a chart type

Charts are data, not code: a chart is a `ChartSpec` (type + config) stored as JSON and rendered
by a pure function. Adding a type touches four places.

## 1. Spec — `packages/shared/src/chart.ts`

- Add the name to `chartTypeSchema`.
- Add a `<type>ConfigSchema` (Zod) with column names as strings and any options with defaults.
- Add the branch to `chartSpecSchema`. Existing saved charts must keep parsing — only add
  optional fields to existing configs.

## 2. Renderer — `packages/charts/src/build.ts`

- Add a `build<Type>()` that returns an ECharts option, and a case in `buildChart()`.
- Add the type to `RENDERERS` in `renderer.ts` and a default in `suggestSpec()`.
- Register any new ECharts chart/component in `src/echarts.ts` (tree-shaken imports).
- Throw `ChartDataError` for user-fixable problems (missing column, wrong type).

**Design rules (from the dataviz skill — follow them):**

- Colors come from `THEMES[mode].categorical`, assigned in order. Never generate a 9th hue: fold
  extras into "Other" (`MAX_SERIES`). Color follows the entity (first appearance), not rank.
- **One y-axis.** No dual-axis charts; use two charts instead.
- Sequential data = one hue light→dark; diverging = two hues + neutral midpoint. No rainbows.
- Thin marks (2px lines, ≥8px markers), 4px rounded data ends, surface-colored gaps between fills.
- Legend only for ≥2 series; text uses text tokens, never series colors; recessive grid.
- Tooltips on hover. Big single values are a `big-number`, not a chart.
- Dark mode uses the dark tokens (`mode === 'dark'`), not an inversion.
- If you add a palette, run the dataviz validator on it before shipping.

## 3. Builder UI — `apps/web/src/components/chart-builder.tsx`

- Add an entry to `TYPE_META` (label + lucide icon).
- Add a case to `SpecFields` with `ColumnSelect`s for the config. Numeric-only fields should
  offer numeric columns.

## 4. Tests and a visual check

- Unit tests in `packages/charts/src/build.test.ts`: happy path, missing column → `ChartDataError`,
  series folding if relevant, dark tokens.
- Render it and look at it: build a chart on the sample shop database (`pnpm db:up`), open it in
  the builder and on a dashboard, in light and dark mode. Check labels don't collide.

Finish with `pnpm check`.
