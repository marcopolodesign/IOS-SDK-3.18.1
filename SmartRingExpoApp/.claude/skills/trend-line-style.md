# Skill: trend-line-style

Apply the Focus design system line chart style to a `TrendLineChart` usage and its parent `MetricSection`-style component.

## What this style does

| Aspect | Value |
|---|---|
| Line | Straight segments (no cubic smoothing) |
| Dots | Every point marked — `fill="black" stroke="#FFFFFF" strokeWidth={1.5}` |
| Active dot | `r={5.5}`, `fill="black" stroke="#FFFFFF" strokeWidth={2}` |
| Gradient fill | None (removed) |
| Horizontal guide lines | None (removed) |
| Y axis | Left-side labels only, no tick lines |
| Date labels | Below chart, day + abbreviated month, highlights on hover |
| Hover interaction | Vertical dashed line at touched point; title + value rows in the parent card update to show the hovered date and value; no on-graph text overlay |
| Haptics | `ImpactFeedbackStyle.Light` fired on each new point during drag |

## Props to set on `<TrendLineChart>`

```tsx
<TrendLineChart
  data={series.map(s => ({ dateKey: s.bucketKey, value: s.value ?? 0 }))}
  height={CHART_H}
  width={availableWidth}
  color="#FFFFFF"        // white line; change to metric accent if preferred
  showAllDots            // black + white border dots on every point
  showDateLabels         // day/month labels below chart
  showYAxis              // Y axis labels on left (uses formatValue for tick text)
  formatValue={metric.formatValue}
  onActiveChange={setHoverDateKey}   // bubbles dateKey up to parent
/>
```

## Props NOT to set (disabled by default)

- `showEndDot` — leave unset (suppressed when `showAllDots` is true)
- `bandRange` — only set if you have a baseline band to show
- Do NOT pass an `onActiveChange` that renders anything on the chart itself — all feedback goes to the parent card

## Parent card changes (MetricSection pattern)

The parent component needs:

```tsx
const [hoverDateKey, setHoverDateKey] = useState<string | null>(null);

const { displayTitle, displayValue } = useMemo(() => {
  if (!hoverDateKey) return { displayTitle: null, displayValue: null };
  const entry = series.find(s => s.bucketKey === hoverDateKey);
  const val = entry?.value ?? null;
  const d = new Date(hoverDateKey + 'T12:00:00');
  const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return {
    displayTitle: dateStr,
    displayValue: val !== null && val > 0 ? metric.formatValue(val) : '--',
  };
}, [hoverDateKey, series, metric]);

// Title row uses: displayTitle ?? t(metric.labelKey)
// Value row uses: displayValue ?? formattedCurrent
```

## TrendLineChart internal checklist

When reviewing a `TrendLineChart` implementation, verify:

- [ ] Line path uses `pts.map((p,i) => \`${i===0?'M':'L'} ${p.x} ${p.y}\`).join(' ')` — not `monotoneCubicPath`
- [ ] No `<Path d={areaPath} ...>` fill
- [ ] No `<Defs><LinearGradient>` block
- [ ] Y axis renders `<SvgText>` only — no `<Line>` guide lines
- [ ] Regular dots: `fill="black" stroke="#FFFFFF" strokeWidth={1.5}`
- [ ] Active dot in hover block: same style, `r={5.5} strokeWidth={2}`
- [ ] Hover block: `<Line strokeDasharray="3,4">` vertical + active dot only — no `<SvgText>` label on the graph

## Applying to a new metric

1. Change the metric's `chartType` in `domains.ts` from `'bar'` or `'clockTime'` to `'line'`
2. Remove `clockRange` if present (line chart auto-scales)
3. Add `onActiveChange` + `hoverDateKey` state to the parent card
4. Set `showAllDots`, `showDateLabels`, `showYAxis` on the `<TrendLineChart>` call
5. Wire `displayTitle` / `displayValue` into the title and value rows
6. Adjust `chartWrap` to `overflow: 'visible'` (not `hidden`) so date labels below aren't clipped
