# Agent Prompt: SVG Icon Audit & Migration

## Goal
Find every inline SVG component defined directly inside a screen or component file (i.e. a function that returns `<Svg>...</Svg>` defined locally, not imported from `src/assets/icons/`), extract it to `src/assets/icons/`, and update all import sites.

## Context
The project lives at `/Users/mataldao/Local/Focus/SmartRingExpoApp/`.

The icon library lives at `src/assets/icons/`. Each icon is a `.tsx` file with:
- A named export + default export
- Props: `size?: number` (square) or `width?`/`height?` (non-square) + `color?: string` with sensible defaults
- `Svg` + shape primitives from `react-native-svg`
- No inline styles, no StyleSheet — just the SVG

Barrel file: `src/assets/icons/index.ts` — every icon must be re-exported from here.

Existing icons (already migrated, do NOT re-create):
`BedtimeIcon`, `SleptIcon`, `WakeTimeIcon`, `NightTimeIcon`, `SleepScoreIcon`, `SleepIcon`, `ActivityIcon`, `OverviewIcon`, `RingIcon`, `BandIcon`

## What to do

1. **Search** every `.tsx` file under `src/` for inline SVG components — functions or arrow functions defined in the same file that return a `<Svg>` element. Look for patterns like:
   - `function XyzIcon() { return <Svg ...>` 
   - `const XyzIcon = () => <Svg ...`
   - A JSX block `<Svg width=... viewBox=...>` that is NOT inside a file in `src/assets/icons/`

2. **For each one found:**
   a. Create `src/assets/icons/<IconName>.tsx` following the existing pattern (see `BedtimeIcon.tsx` or `WakeTimeIcon.tsx` as reference)
   b. Add the export to `src/assets/icons/index.ts`
   c. In the original file: remove the inline definition, add the import from `'../../assets/icons'` (adjust relative depth as needed), update all usages

3. **Do not touch** files already inside `src/assets/icons/` — those are already correct.

4. **Do not migrate** SVG that is rendered inside an `<Svg>` chart (e.g. `SleepHypnogram.tsx` uses `<Svg>` as a chart canvas — those are not icon components and must stay).

5. After all migrations, run a final grep to confirm no inline SVG component functions remain outside `src/assets/icons/`.

6. Update `catchup.md` with a summary entry (Source: Claude Code — Macbook Pro).

## Reference file structure

```
src/assets/icons/
  BedtimeIcon.tsx      ← bed SVG, props: width=17 height=14 color='white'
  SleptIcon.tsx        ← moon crescent SVG, props: size=20 color='white'
  WakeTimeIcon.tsx     ← sun SVG, props: focused color='white'
  index.ts             ← re-exports all icons
```
