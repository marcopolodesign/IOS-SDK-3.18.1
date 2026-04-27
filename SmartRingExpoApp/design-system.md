# Focus App — Design System

Extracted from `src/theme/colors.ts` and component patterns in `StyledHealthScreen`, `FocusScreen`, `NewHomeScreen`, `OverviewTab`, `ActivityTab`.

---

## Color Tokens

All imported from `src/theme/colors.ts`:

```ts
import { colors } from '../theme/colors';
```

### Backgrounds
| Token | Value | Usage |
|-------|-------|-------|
| `colors.background` | `#0D0D0D` | Root screen background |
| `colors.backgroundSecondary` | `#141414` | Secondary surfaces |
| `colors.surface` | `#1A1A2E` | Card base |
| `colors.surfaceLight` | `#252542` | Input fields, chip backgrounds |
| `colors.card` | `#1E1E32` | Solid card fill |
| `colors.cardHover` | `#282848` | Hover state |

### Primary Accent — Teal/Mint
| Token | Value |
|-------|-------|
| `colors.primary` | `#00D4AA` |
| `colors.primaryDark` | `#00A88A` |
| `colors.primaryLight` | `#33DDBB` |
| `colors.primaryGlow` | `rgba(0, 212, 170, 0.2)` |

### Secondary Accent — Coral (Heart Rate)
| Token | Value |
|-------|-------|
| `colors.secondary` | `#FF6B6B` |
| `colors.secondaryGlow` | `rgba(255, 107, 107, 0.2)` |

### Tertiary Accent — Blue (Sleep)
| Token | Value |
|-------|-------|
| `colors.tertiary` | `#6B8EFF` |
| `colors.tertiaryGlow` | `rgba(107, 142, 255, 0.2)` |

### Health Metric Colors
| Metric | Color |
|--------|-------|
| Heart Rate | `#FF6B6B` |
| Steps | `#00D4AA` |
| Sleep | `#6B8EFF` |
| Calories | `#FFB84D` |
| SpO₂ | `#B16BFF` |
| Blood Pressure | `#FF6BCC` |
| Stress | `#FF9F6B` |
| Temperature | `#6BFFF5` |
| HRV | `#C4FF6B` |

### Text
| Token | Value | Usage |
|-------|-------|-------|
| `colors.text` | `#FFFFFF` | Primary text |
| `colors.textSecondary` | `#A0A0A0` | Secondary labels |
| `colors.textMuted` | `#666666` | Placeholder, disabled |
| `colors.textInverse` | `#0D0D0D` | Text on light backgrounds |

### Status
| Token | Value |
|-------|-------|
| `colors.success` | `#00D4AA` |
| `colors.warning` | `#FFB84D` |
| `colors.error` | `#FF6B6B` |
| `colors.info` | `#6B8EFF` |

### Borders
| Token | Value |
|-------|-------|
| `colors.border` | `#2A2A4A` |
| `colors.borderLight` | `#3A3A5A` |

### Overlay
| Token | Value |
|-------|-------|
| `colors.overlay` | `rgba(0, 0, 0, 0.7)` |
| `colors.overlayLight` | `rgba(0, 0, 0, 0.3)` |

---

## Typography

```ts
import { fontFamily, fontSize } from '../theme/colors';
```

### Font Families
| Token | Value |
|-------|-------|
| `fontFamily.regular` | `'TT-Interphases-Pro-Regular'` |
| `fontFamily.demiBold` | `'TT-Interphases-Pro-DemiBold'` |

### Font Sizes
| Token | px | Usage |
|-------|----|-------|
| `fontSize.xs` | 10 | Badges, chips, micro labels |
| `fontSize.sm` | 12 | Secondary text, metadata |
| `fontSize.md` | 14 | Body, row labels |
| `fontSize.lg` | 16 | Section values, name |
| `fontSize.xl` | 20 | Card titles |
| `fontSize.xxl` | 28 | Screen titles |
| `fontSize.xxxl` | 36 | Large display numbers |
| `fontSize.display` | 48 | Hero score display |

---

## Spacing Scale

```ts
import { spacing } from '../theme/colors';
```

| Token | px |
|-------|----|
| `spacing.xs` | 2 |
| `spacing.sm` | 6 |
| `spacing.md` | 12 |
| `spacing.lg` | 18 |
| `spacing.xl` | 24 |
| `spacing.xxl` | 30 |

---

## Border Radius

```ts
import { borderRadius } from '../theme/colors';
```

| Token | px | Usage |
|-------|----|-------|
| `borderRadius.sm` | 8 | Small chips, buttons |
| `borderRadius.md` | 12 | Input fields, small cards |
| `borderRadius.lg` | 16 | Standard cards |
| `borderRadius.xl` | 24 | Glass cards, modals |
| `borderRadius.full` | 9999 | Pills, avatars |

---

## Shadows

```ts
import { shadows } from '../theme/colors';
```

### Preset Shadows
```ts
shadows.sm  // subtle: y=2, blur=4
shadows.md  // medium: y=4, blur=8
shadows.lg  // large: y=8, blur=16
```

### Glow Function
```ts
shadows.glow(color: string) // => { shadowColor: color, offset: 0,0, opacity: 0.4, radius: 12 }

// Usage:
...shadows.glow(colors.primary)  // teal avatar ring glow
...shadows.glow(colors.secondary) // coral metric glow
```

---

## Glass Card Pattern

The primary card style used throughout Health, Overview, Sleep, and Focus tabs:

```ts
const glassCard = {
  backgroundColor: 'rgba(255, 255, 255, 0.07)',
  borderColor: 'rgba(255, 255, 255, 0.12)',
  borderWidth: 1,
  borderRadius: borderRadius.xl, // 24
};

// Lighter variant (higher prominence)
const glassCardLight = {
  backgroundColor: 'rgba(255, 255, 255, 0.10)',
  borderColor: 'rgba(255, 255, 255, 0.20)',
  borderWidth: 1,
  borderRadius: borderRadius.xl,
};
```

### Glass Row Separator
```ts
borderBottomWidth: 1,
borderBottomColor: 'rgba(255, 255, 255, 0.06)',
```

---

## Gradient Presets

```ts
import { colors } from '../theme/colors';

// Built-in gradient arrays (for LinearGradient)
colors.gradients.primary    // ['#00D4AA', '#00A88A'] — teal
colors.gradients.secondary  // ['#FF6B6B', '#E55555'] — coral
colors.gradients.tertiary   // ['#6B8EFF', '#5070E0'] — blue
colors.gradients.card       // ['#1A1A2E', '#252542'] — dark card
colors.gradients.dark       // ['#0D0D0D', '#1A1A2E'] — deep dark
colors.gradients.heartRate  // ['#FF6B6B', '#FF8888']
colors.gradients.sleep      // ['#6B8EFF', '#8AAAFF']
```

### Per-Tab Radial Gradient Overlays
Each tab uses a distinct radial/bloom overlay over the black background:

| Screen | Gradient | Bloom Color |
|--------|----------|-------------|
| Overview (Today) | `['#000000', 'rgba(0,212,170,0.10)', '#000000']` | Teal |
| Health / Sleep | `['#000000', 'rgba(107,142,255,0.12)', '#000000']` | Blue |
| Activity | `['#000000', 'rgba(255,107,107,0.10)', '#000000']` | Coral |
| Focus (Coach) | `['#000000', 'rgba(255,184,77,0.08)', '#000000']` | Amber |
| Profile | `['#000000', 'rgba(0,212,170,0.12)', '#000000']` | Teal (subtle, distinct from Today) |

---

## Bottom Sheet / Explainer Sheet Color Rule

> **NO COLOR inside explainer, formula, or score-detail bottom sheets.**
>
> Explainer sheets (score breakdowns, formula explanations, metric education) must be **monochrome only**: white, grey, and semi-transparent white variants. No accent colors (green/amber/red/blue/teal/coral) inside any bottom sheet that explains how a score or metric was calculated.
>
> - Progress bars inside sheets: `rgba(255,255,255,0.35)` fill, `rgba(255,255,255,0.08)` track
> - Chart bars: white with opacity fade (oldest dim → newest bright)
> - Baseline lines: `rgba(255,255,255,0.45)` dashed
> - Labels and text: white opacity hierarchy (see above)
>
> **Why:** Accent colors signal current state/health status on main screens. Using them inside an educational explainer creates false urgency and conflicts with the neutral "here's how the math works" tone the sheet is meant to have.

---

## Opacity Hierarchy (Dark Theme)

| Role | Opacity | Hex approx |
|------|---------|------------|
| Primary text | 100% | `#FFFFFF` |
| Secondary text | ~63% | `rgba(255,255,255,0.63)` |
| Tertiary / placeholders | ~50% | `rgba(255,255,255,0.50)` |
| Disabled / muted | ~30% | `rgba(255,255,255,0.30)` |
| Glass bg | 7–10% | `rgba(255,255,255,0.07–0.10)` |
| Glass border | 12–20% | `rgba(255,255,255,0.12–0.20)` |
| Row separator | 6% | `rgba(255,255,255,0.06)` |
| Backdrop | 70% | `rgba(0,0,0,0.70)` |

---

## Component Patterns

### Screen Container
```tsx
<View style={{ flex: 1, backgroundColor: colors.background }}>
  <SafeAreaView style={{ flex: 1 }} edges={['top']}>
    <ScrollView>...</ScrollView>
  </SafeAreaView>
</View>
```

### Section Header
```ts
{
  fontSize: fontSize.md,          // 14px
  fontFamily: fontFamily.demiBold,
  color: colors.textSecondary,    // #A0A0A0
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: spacing.md,       // 12
}
```

### Glass Card
```tsx
<View style={{
  backgroundColor: 'rgba(255,255,255,0.07)',
  borderColor: 'rgba(255,255,255,0.12)',
  borderWidth: 1,
  borderRadius: borderRadius.xl,  // 24
  overflow: 'hidden',
}}>
  {/* rows with separator */}
</View>
```

### Glass Card Row
```tsx
<View style={{
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingVertical: spacing.md,       // 12
  paddingHorizontal: spacing.lg,     // 18
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(255,255,255,0.06)',
}}>
  <Text style={{ fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.text }}>
    Label
  </Text>
  {/* right: Switch / Text / Chevron */}
</View>
```

### Avatar (Initials)
```tsx
<View style={{
  width: 60,
  height: 60,
  borderRadius: 30,
  backgroundColor: colors.primary,
  justifyContent: 'center',
  alignItems: 'center',
  ...shadows.glow(colors.primary),
}}>
  <Text style={{
    fontSize: 22,
    fontFamily: fontFamily.demiBold,
    color: colors.textInverse,
  }}>
    {initial}
  </Text>
</View>
```

### Badge / Chip

> **Rule: no borders on chips unless explicitly requested.**
> Default chip style is a white semi-transparent background (`rgba(255,255,255,0.15)`) with white text. This keeps chips visually lightweight on dark surfaces. Borders are only added when a specific design explicitly calls for them (e.g. a severity chip that needs a colored outline to communicate urgency).
>
> **Reference:** the `CLEAR` / `WATCH` / `SICK` chip on the Illness Watch detail screen (top-right of the nav row) is the canonical example — no border, white bg at 15% opacity, white text.

```tsx
// Default chip — no border, white bg opacity
<View style={{
  backgroundColor: 'rgba(255,255,255,0.15)',
  paddingHorizontal: 14,
  paddingVertical: 5,
  borderRadius: borderRadius.full,
}}>
  <Text style={{ fontSize: fontSize.sm, fontFamily: fontFamily.demiBold, color: '#FFFFFF', letterSpacing: 1 }}>
    CLEAR
  </Text>
</View>

// Accent chip (status badge with color tint) — only when color context matters
<View style={{
  backgroundColor: `${accentColor}20`,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderRadius: borderRadius.sm,
}}>
  <Text style={{ fontSize: fontSize.xs, fontFamily: fontFamily.demiBold, color: accentColor }}>
    EN
  </Text>
</View>
```

### Switch Row
```tsx
<Switch
  value={value}
  onValueChange={onChange}
  trackColor={{ false: colors.surfaceLight, true: colors.primaryDark }}
  thumbColor={value ? colors.primary : colors.textMuted}
/>
```

### Collapsible Card Header
- Arrow rotates 180° when expanded (Animated or static)
- `backgroundColor: 'rgba(255,255,255,0.04)'` on pressed state
- `borderRadius: borderRadius.xl` outer container

### Score Labels (StyledHealthScreen)
| Score | Label | Color |
|-------|-------|-------|
| 85–100 | OPTIMAL | `colors.primary` (#00D4AA) |
| 70–84 | GOOD | `#C4FF6B` (HRV green) |
| 50–69 | FAIR | `colors.warning` (#FFB84D) |
| 0–49 | NEEDS REST | `colors.error` (#FF6B6B) |

---

## i18n Usage

All user-visible strings are wrapped with `useTranslation()`:

```tsx
import { useTranslation } from 'react-i18next';

function MyScreen() {
  const { t } = useTranslation();
  return <Text>{t('profile.title')}</Text>;
}
```

Supported languages: `en` (English), `es` (Spanish).
Language persists via `AsyncStorage` key `app_language_v1`.
Falls back to device locale on first launch.
