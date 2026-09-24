---
name: Monotask
description: A monochrome, motion-forward productivity app for tasks, habits, and calendar in one place.
colors:
  background: "hsl(0 0% 7%)"
  foreground: "hsl(0 0% 98%)"
  card: "hsl(0 0% 7%)"
  card-foreground: "hsl(0 0% 98%)"
  popover: "hsl(0 0% 7%)"
  popover-foreground: "hsl(0 0% 98%)"
  primary: "hsl(0 0% 98%)"
  primary-foreground: "hsl(0 0% 9%)"
  brand: "hsl(0 0% 98%)"
  brand-foreground: "hsl(0 0% 9%)"
  secondary: "hsl(0 0% 15%)"
  secondary-foreground: "hsl(0 0% 98%)"
  muted: "hsl(0 0% 15%)"
  muted-foreground: "hsl(0 0% 65%)"
  accent: "hsl(0 0% 15%)"
  accent-foreground: "hsl(0 0% 98%)"
  destructive: "hsl(4 68% 60%)"
  destructive-foreground: "hsl(0 0% 7%)"
  border: "hsl(0 0% 15%)"
  input: "hsl(0 0% 15%)"
  ring: "hsl(0 0% 98%)"
  background-light: "hsl(0 0% 98%)"
  foreground-light: "hsl(0 0% 5%)"
  card-light: "hsl(0 0% 100%)"
  primary-light: "hsl(0 0% 9%)"
  primary-foreground-light: "hsl(0 0% 100%)"
  secondary-light: "hsl(0 0% 96%)"
  muted-light: "hsl(0 0% 96%)"
  muted-foreground-light: "hsl(0 0% 45%)"
  accent-light: "hsl(0 0% 96%)"
  destructive-light: "hsl(4 62% 44%)"
  destructive-foreground-light: "hsl(0 0% 98%)"
  border-light: "hsl(0 0% 90%)"
typography:
  display:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 4vw, 3.75rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.02em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  operate-sm: "4px"
  operate-md: "6px"
  operate-lg: "8px"
  operate-pill: "9999px"
  persuade-lg: "16px"
  persuade-xl: "24px"
  persuade-pill: "9999px"
spacing:
  container-padding: "2rem"
  container-max: "1400px"
  section-py-operate: "1.5rem"
  section-py-persuade: "6rem"
  stack-gap-sm: "0.75rem"
  stack-gap-md: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.operate-lg}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.operate-lg}"
    padding: "10px 16px"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    rounded: "{rounded.operate-lg}"
    padding: "10px 16px"
  card-operate:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.operate-lg}"
    padding: "16px"
  badge-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.operate-pill}"
    padding: "2px 10px"
---

# Design System: Monotask

## Overview

**Creative North Star: "One Thing At A Time"**

Monotask is a task, habit, and calendar app for people managing focus across too many apps. The design system takes the product's own thesis and applies it to itself: just as the product removes app-switching, the interface removes the accent color, the decorative motion, and the competing visual signals that most SaaS products lean on. What's left is a strict monochrome palette (true near-black and near-white, never pure `#000`/`#fff`), two typefaces doing very deliberate jobs, and a motion language that exists to demonstrate the product working, not to decorate around it. Color, when it appears at all outside the neutral scale, is reserved for one thing: the destructive/error state. Everything else earns attention through weight, scale, spacing, and physics instead.

The system runs two registers, not one, and this is intentional rather than inconsistent: the authenticated app (Operate mode - Dashboard, Tasks, Calendar, Habits, Tags, Progress, Settings) is tight, fast, and shadcn-scaled, because the visitor is completing a task and speed/consistency outrank expression. The marketing site (Persuade mode - the landing and auth pages) is looser, larger-radius, and cinematic, because the visitor is deciding whether to trust the product and the design is doing persuasive work. Same tokens, same neutral base, different amplitude. See the Shapes section for the concrete split.

Dark is the default theme system-wide, not a toggle-able afterthought; light mode is fully supported and tonally inverted but treated as the secondary mode.

**Key Characteristics:**
- Pure monochrome neutrals (near-black/near-white), zero decorative accent color
- One real semantic exception: a muted brick-red destructive/error hue
- Dark-by-default, light mode fully inverted and supported
- Two typefaces: Space Grotesk for display, Geist for body and UI, Geist Mono for numbers/data
- Motion is either physics-based (spring) or a single shared expo-out ease - never a default CSS ease
- Flat-by-default surfaces; real elevation (shadow, glass) reserved for things that are actually floating above the page
- Two radius registers by surface type: tight/shadcn-scaled in the app, soft/pill-heavy on marketing surfaces

## Colors

Strict monochrome. Every neutral in the palette is a step of true gray (0% saturation) - no warm or cool tint, no off-black-with-a-hue-cast. The only saturated color in the entire system is the destructive red, and it is load-bearing: it is the one signal in the whole app that a user should treat as "pay attention," precisely because nothing else competes with it.

### Primary
- **Near-White (Dark mode)** (`hsl(0 0% 98%)` on `hsl(0 0% 9%)` foreground): the primary action color in dark mode (buttons, active states, focus rings, the `--brand` alias). Reads as "the one light thing in a dark interface."
- **Near-Black (Light mode)** (`hsl(0 0% 9%)` on `hsl(0 0% 100%)` foreground): the mirror of the above when the system sits in light mode.

### Neutral
- **True Black Background** (`hsl(0 0% 7%)`): the dark-mode page background. Never pure `#000000` - full black kills perceived depth against white text and card surfaces.
- **True White Background (Light mode)** (`hsl(0 0% 98%)`): the light-mode page background. Never pure `#ffffff`, for the same reason.
- **Card Surface** (`hsl(0 0% 7%)` dark / `hsl(0 0% 100%)` light): card backgrounds sit one step lighter (dark mode) or brighter (light mode) than the page.
- **Secondary / Muted Surface** (`hsl(0 0% 15%)` dark / `hsl(0 0% 96%)` light): input fills, inactive chips, hover backgrounds, secondary buttons.
- **Muted Text** (`hsl(0 0% 65%)` dark / `hsl(0 0% 45%)` light): timestamps, helper text, secondary labels. Always checked against its background for WCAG AA.
- **Border** (`hsl(0 0% 15%)` dark / `hsl(0 0% 90%)` light): hairline dividers and card outlines. This is the primary hierarchy tool in a flat-by-default system - see Elevation & Depth.

### Semantic (the one exception)
- **Destructive Red** (`hsl(4 68% 60%)` dark / `hsl(4 62% 44%)` light): errors, delete actions, overdue-task indicators, failed sync states. Deliberately desaturated (a "muted brick red," not an alarm red) so it reads as serious without becoming the loudest thing on screen purely by being a saturated color in a monochrome field.

### Named Rules
**The Color Consistency Lock Rule.** Once the palette is monochrome-plus-destructive-red, it stays that way everywhere. No feature, no matter how tempting ("just this one chart could use blue"), introduces a second decorative hue. Tags and calendar categories are the sole user-controlled exception (see Components → Tags), because that color is real user data, not decoration, and it never competes with the destructive signal or a UI action color.

**The No Pure Black/White Rule.** Background and foreground extremes stop at `hsl(0 0% 7%)` / `hsl(0 0% 98%)`. Pure `#000`/`#fff` are never used; they flatten depth perception against everything layered on top of them.

## Typography

**Display Font:** Space Grotesk (with `system-ui, sans-serif` fallback)
**Body Font:** Geist (with `system-ui, sans-serif` fallback)
**Label/Mono Font:** Geist Mono (with `ui-monospace, monospace` fallback)

**Character:** Space Grotesk is used sparingly and only at real display scale (page-level H1s, hero headlines) - it's geometric and a little unusual, so it earns attention precisely by staying rare. Geist carries every other word in the interface: legible, neutral-but-not-generic, chosen specifically to move away from Inter (the default every AI-generated interface reaches for). Geist Mono handles anything that is fundamentally a number or a piece of literal data - task counts, streak counts, dates, the AI Quick Add input - because tabular alignment and a monospace's "this is data, not prose" signal both matter there.

### Hierarchy
- **Display** (700, `clamp(1.5rem, 4vw, 3.75rem)`, 1.05 line-height, -0.02em tracking): hero headlines and the single H1 per view. Space Grotesk only.
- **Headline** (600-700, 1.5-2.25rem, 1.1-1.2 line-height): section headings within a page (e.g. "Every detail, covered."). Space Grotesk.
- **Body** (400-500, 1rem, 1.5 line-height): all prose, descriptions, form labels. Geist. Long-form copy is capped near 65ch.
- **Label** (500, 0.75-0.875rem, 0.02em tracking): eyebrows, badges, tab triggers, metadata. Geist, used sparingly - see the eyebrow-restraint rule below.
- **Numeric / Mono** (400-500, 0.875-1rem, tabular): counts, dates, timestamps, the AI-parsed input field. Geist Mono, always with `tabular-nums` where values change (streak counters, task counts).

### Named Rules
**The Eyebrow Restraint Rule.** Small uppercase-tracked labels above a heading appear on at most one section in every three. Used on every section, they stop meaning anything and just add visual noise - this is the single most common AI-generated-interface tell.

**The Zero Em-Dash Rule.** No em-dash (`—`) appears anywhere in shipped copy - headlines, labels, body, error messages, alt text. Use a period, comma, or regular hyphen instead. This is enforced mechanically before anything ships.

## Layout

The app interior (Operate) uses a fixed sidebar + top bar + scrollable content shell, `min-w-0` flex children throughout so long content never blows out the layout, and a single persistent page-level `<h1>` owned by the top bar - individual views never repeat their own title beneath it; they lead with their actual content (stats, filters, primary action) instead.

The marketing site (Persuade) is a single scrolling column, `max-w-6xl`/`max-w-5xl` centered containers depending on section, `px-4 sm:px-6 lg:px-8` horizontal padding, and generous vertical rhythm (`py-24` between major sections) so a content-dense page still reads as unhurried. Breakpoints follow Tailwind defaults (`sm` 640 / `md` 768 / `lg` 1024 / `xl` 1280 / `2xl` 1400, the last one set explicitly via the container config rather than Tailwind's default 1536).

Asymmetric layouts (the hero's split, feature spotlights) collapse to a strict single column below `md`, always with an explicit mobile treatment declared alongside the desktop one, never left to "Tailwind will handle it."

### App Shell & Page Layout
Every app page renders inside one shared container owned by the shell (`Index.tsx`): `mx-auto w-full max-w-6xl` with `p-4 sm:p-6 lg:p-8`. Individual views never set their own outer padding or max-width, which is what keeps left edges aligned as you move between pages. Form-like pages (Settings, Tags, Suggestions) narrow themselves to `max-w-3xl` inside that container because forms read badly stretched across 1150px.

- **Sidebar:** logo tile plus wordmark, three labelled groups (Plan: Dashboard, Tasks, Calendar, Events, Habits; Insights: Suggestions, Progress; Manage: Tags, Settings) with mono uppercase group labels, a quiet `bg-accent` active pill with a thin left indicator (no glow), and a user chip at the bottom (avatar initial, name, email or "Guest account", sign-out icon).
- **Page intro line:** each view starts with one muted description line (`text-[15px] text-muted-foreground`) beside its primary action. The single page `<h1>` stays in the top bar.
- **Stat cards:** mono uppercase label, large tight-tracked numeral (`text-4xl`), bordered icon tile. Hover changes only the border, never a shadow or glow.
- **Cards:** `rounded-xl border border-border bg-card`, flat, no shadow.
- **Home surfaces the differentiator:** the Dashboard shows a "N suggestions waiting for your review" banner when AI suggestions are pending, since reviewing them is the core loop.
- **Lists grouped, not stacked:** Events groups by day (Today, Tomorrow, weekday) inside hairline-divided cards with a fixed time column; row actions appear on hover or focus on desktop and stay visible on touch.
- **Heatmaps** use fixed small cells (weeks as columns), never `aspect-square` cells in a full-width grid, which balloons to 150px squares.
- **Sign-in page:** a split layout whose inverted brand panel mirrors the landing page (hidden below `lg`).

## Elevation & Depth

Flat by default. Cards and list rows in the app interior carry a 1px `border` and nothing else at rest - hierarchy comes from spacing, grouping, and border presence/absence, not drop shadows. Real elevation (shadow or glass) is reserved for things that are genuinely floating above the page: modals, popovers, dropdowns, the sidebar's mobile drawer scrim. This keeps a shadow meaning something when it does appear, instead of every card having one by default.

Two elevation techniques are in active use:

1. **Tinted hover shadows.** Interactive cards (Dashboard stat cards, feature cards) are flat at rest and pick up a soft, primary-tinted shadow only on hover - `shadow-[0_16px_36px_-18px_hsl(var(--primary)/0.55)]` - never a generic black shadow, which would read as an unrelated smudge against a colored card family. The Dashboard's "Due today" stat card carries an optional thin progress bar under its value when the underlying number is a real ratio (tasks due today that are actually done, not a raw count) - the bar is omitted entirely on days with nothing due, rather than showing a meaningless 0%.
2. **Glassmorphism, floating layers only.** Modals and the mobile sidebar scrim use `backdrop-blur-xl` plus a translucent background (`bg-background/90`) and a hairline border at slightly higher opacity than the resting border, with an explicit solid-fill fallback under `prefers-reduced-transparency`. Never applied to primary content surfaces (page body, main card grids) - glass reads as "elevation," and applying it everywhere would cheapen it into a texture.

### Shadow Vocabulary
- **Hover lift (interactive card)** (`shadow-[0_16px_36px_-18px_hsl(var(--primary)/0.55)]`): stat cards and feature cards on hover, paired with a `-translate-y-1` lift.
- **Modal / overlay** (`backdrop-blur-xl` + `bg-background/90` + `border-border/80`): dialogs, the upgrade account modal, the mobile nav drawer.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. A shadow or glass treatment appears only as a response to state (hover, floating-above-the-page) - never as ambient decoration on a resting card.

## Shapes

Two deliberate radius registers, matched to the two modes described in Overview:

- **Operate (app interior):** the shadcn scale - `lg` = `var(--radius)` = 8px, `md` = 6px, `sm` = 4px. Tight, consistent, used for every button/card/input/dialog in the authenticated app. Pills (`rounded-full`) appear only for genuinely pill-shaped elements (badges, the sidebar's active-nav indicator).
- **Persuade (landing/auth):** noticeably softer - `16px`/`24px` card radii, and pills used liberally for buttons, tab triggers, and nav chips. This isn't drift; it matches the more expressive, cinematic register the marketing surface is allowed to run at.

Borders are 1px, always `border-border` (never a hardcoded gray), and are the primary tool for separating content in the flat-by-default system - `divide-y`/`border-t` groupings are preferred over wrapping every row in its own bordered card.

### Named Rules
**The One Radius Per Surface Rule.** A single view never mixes the Operate and Persuade radius scales. If a component appears in both contexts (rare - most are surface-specific), it uses whichever scale its host surface has committed to.

## Components

The component feel across the whole system: **quiet and precise.** Nothing shouts by default - no idle pulsing, no gratuitous shadow, no color reaching for attention - but every interactive element responds to touch with real, considered physics (spring-based, never a flat CSS `ease`), so precision is felt the moment you engage rather than announced up front.

### Motion Contract (applies to every component below)
- **Standard ease:** `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) for all non-spring transitions - entrances, fades, color transitions. Duration scales with what's moving: 0.2-0.3s for micro-interactions, 0.5-0.6s for section-level reveals.
- **Snappy spring:** `{ stiffness: 300, damping: 30 }` - buttons, checkboxes, toggles, drag-release, the sliding tab indicator.
- **Panel spring:** `{ stiffness: 100, damping: 20 }` - larger panel and section entrances (stat card grids, dashboard sections).
- **Stagger:** 0.05-0.08s between siblings in any list/grid reveal.
- **View transitions:** app-interior navigation (Dashboard → Tasks → Calendar, etc.) goes through the browser's native View Transitions API rather than a component-level fade - `0.32s` for the whole-view cross-fade, `0.38s` for shared elements (task rows that appear in both the Dashboard preview and Task Manager use a matching `view-transition-name` so they visually morph between views instead of cutting).
- **`prefers-reduced-motion` is checked in every single animated component**, without exception - the reduced-motion path is never an afterthought bolted onto a finished animation, it's part of the same code path from the start (in React, via framer-motion's `useReducedMotion()`; at the CSS level for the View Transition pseudo-elements, as a hard backstop).
- Only `transform` and `opacity` are ever animated for continuous/high-frequency motion (drag, hover, scroll-tied effects) - never `top`/`left`/`width`/`height`, for compositor-only performance.

### Buttons
- **Shape:** Operate scale `rounded-lg` (8px) in the app; pill (`rounded-full`) on the marketing site.
- **Primary:** `bg-primary` / `text-primary-foreground` - resolves to near-white-on-near-black in dark mode. This is the only element that gets the full-strength neutral extreme as a fill; everything else stays inside the mid-range of the neutral scale.
- **Hover / Active:** subtle lift (`-translate-y-1`) or `scale(1.02-1.03)` on hover, `scale(0.97)` on press, via the snappy spring - never a CSS `:active` with no transition.
- **Destructive:** `bg-destructive` / `text-destructive-foreground` - the only button variant that introduces the semantic red.
- **Magnetic (marketing only):** primary CTAs on the landing page track the cursor within a small radius and pull toward it (`useMotionValue`/`useTransform`, never `useState`, per the app's own rule against re-rendering React on continuous pointer input) - reserved for Persuade-mode CTAs, never used in the app interior.

### Cards / Containers
- **Corner Style:** `rounded-lg` (Operate) / `rounded-2xl`-`rounded-3xl` (Persuade).
- **Background:** `bg-card`, one neutral step off the page background.
- **Shadow Strategy:** flat at rest; tinted hover shadow on interactive cards only (see Elevation & Depth).
- **Border:** always present, `border-border`, 1px.
- **Tilt (marketing only):** feature-preview cards on the landing page get a subtle cursor-tracked 3D tilt plus a spotlight highlight that follows the pointer - a Persuade-only technique, never used on functional app cards.

### Task / Habit Rows (signature component)
The app's most-interacted-with component, and the one with the most physical feedback: a checkbox with spring-scale feedback, a six-dot radial particle burst on completion (hand-rolled with `motion.span` elements, not a particle library), and a real drag gesture - drag right past **35% of the row's measured width** to complete, drag left past the same threshold to open the delete-confirmation dialog (the confirmation is never skipped, even via gesture). A background check/trash affordance fades in during the drag so the outcome is legible before release. Optimistic UI updates mean the row reflects the change in the same frame as the interaction, before any network round-trip resolves. Habit rows use the same spring-checkbox language but log a tri-state outcome (Done / Skipped / Missed) rather than a binary toggle.

**Weekly Habit Grid**: each habit row also carries a trailing-7-day strip (real logs, no new query - `useHabits` already loads full log history unbounded) - a filled square for completed, a dash for skipped, a dim dashed outline for missed or not-yet-logged, nothing for future days. Additive context next to the Done/Skip/Miss buttons, not a replacement for them.

**Consistency Matrix** (Habits page, below the habit list): a 30-day density grid across all active habits, reusing the exact `hsl(var(--primary) / opacity)` intensity technique the Progress page's activity heatmap already established (see Charts & Heatmap below) rather than inventing a second shading approach - opacity here is completions-that-day divided by active-habit-count, so a cell means "what fraction of habits got done," not an arbitrary count.

### Tabs (Feature Detail Grid)
A `layoutId`-based pill slides between tab triggers on the snappy spring rather than a hard state swap; the active trigger's label sits on an explicit `relative z-10` layer above the sliding indicator (a fixed CSS-stacking-context bug where a naive `-z-10` on the indicator rendered it behind the trigger's own background, making the active label unreadable - the indicator is now painted first in DOM order with no z-index tricks instead). Tab content re-stagger-reveals every time the active tab changes.

### Task Row Keyboard Navigation
Task Manager rows are real `tabIndex={0}` elements identified by `data-task-row`/`data-task-id`/`data-task-date` (not array index, so nav stays correct across re-renders and works identically in every tab, since Radix Tabs only mounts the active panel's rows). `J`/`K` move native DOM focus between rows (native `:focus-visible` supplies the visual ring, no separate "focused" state to keep in sync), `X` toggles completion of the currently-focused row, `N` focuses the AI Quick Add input. All four are ignored while focus is inside any text input/textarea, so normal typing is never hijacked. A small persistent `J/K navigate · X toggle · N new` hint sits under the task list so the layer is discoverable, not a hidden trick. A command palette (`Cmd/Ctrl+K`, `src/components/CommandPalette.tsx`) provides the same kind of power-user access at the app-shell level: it searches real task titles and habit names already loaded by `useTasks`/`useHabits` (no separate search index, no invented data) and jumps to any of the app's nine views.

### Navigation (Sidebar)
- **Style:** a persistent left rail in the app interior, icon + label pairs, never icon-only (recognition over recall).
- **Active state:** a `layoutId`-based glow chip plus a thin accent bar slide smoothly between nav items on the snappy spring, rather than jump-cutting.
- **Mobile:** collapses to a drawer (shadcn `Sheet`) with a glass-blurred scrim behind it.

### Dialogs / Modals
- **Style:** glass treatment (see Elevation & Depth), spring scale+fade entrance rather than a flat fade.
- **Destructive confirmations:** always a real modal step, never skippable via a gesture or a single misclick.

### Tags
- **Creation:** a fixed 5-step grayscale swatch picker (`#111827`, `#374151`, `#6b7280`, `#9ca3af`, `#d1d5db`), selected via `role="radiogroup"` circular swatches with spring scale feedback on the active choice. **This corrects an earlier version of this document**, which described tags as the system's one arbitrary-color exception - that was true before the monochrome pass reached this component, and is no longer accurate for newly created tags.
- **Known inconsistency (real, not a design decision):** tags created before the monochrome pass (including the seeded demo data - "Work", "Health", "Personal", etc.) still carry their original saturated hex values and render in full color wherever tag chips appear (Dashboard, Task Manager, Habits). New tags can only be grayscale. This is a straggler from the pivot, not an intentional two-tier system - worth a follow-up pass to either regrade legacy tag colors to grayscale or reopen the picker to color, but until that happens, don't treat the colorful chips visible in the running app as current design intent.

### Iconography
lucide-react, exclusively - no hand-rolled SVG icon paths anywhere in the app. `strokeWidth` is not a single fixed value but follows a legibility scale: **2** is the default for most UI icons (58 uses), **1.75** for icons sitting inside dense/small contexts where a lighter line reads better (22 uses - stat card icons, list-row icons), **2.5** reserved for the rare icon that needs to read as an emphasized signal (the completion checkmark, destructive warning triangles), and **1.5** only for the very largest, most decorative icon instances. When a brand logo has no icon-library equivalent (e.g. Microsoft Outlook is not in the Simple Icons catalog - checked directly against their slug list, not a broken link), fall back to the closest generic lucide glyph (`Mail`) rather than shipping a broken image or a guessed-at trademark reproduction.

### Forms & Inputs
- **Style:** `Input`/`Textarea`/`Select` share one visual language - `border-input` (aliases to `border-border`), `bg-background`, `rounded-md` (6px), `px-3 py-2`.
- **Focus:** a 2px `ring-ring` focus ring with `ring-offset-2` against the background - never a bare browser default outline, but also never a glow/shadow-based focus treatment; the ring is a hard, precise line, matching the system's "quiet and precise" component character.
- **Labels:** always above the input, never placeholder-as-label. Helper text and inline validation errors sit below the field, in `text-destructive` when they represent an error.
- **Disabled:** `opacity-50` plus `cursor-not-allowed`, no separate disabled color token.

### Empty & Loading States
- **Empty states** are a shared composed pattern (icon in a muted circle, title, description, optional CTA) used identically across Task Manager, Habits, Tags, and Suggestions - never a bare "No items" string. The icon is muted (`text-muted-foreground` on `bg-muted`), never the primary color, so an empty state doesn't compete visually with content that does exist elsewhere on screen.
- **Loading states** are `Skeleton` components shaped to match the real layout they're replacing (a stat-card skeleton is card-shaped, a task-row skeleton is row-shaped) - never a generic centered spinner. The Dashboard's initial load is the one exception that still uses a spinner (pre-content-shape is known there), documented as a candidate for the same skeleton treatment in a future pass.

### Toasts
Sonner, themed to follow `bg-background` / `text-foreground` / `border-border`, `shadow-lg` on the toast surface. Its `theme` prop is driven by a small `useIsDark()` hook that reads the `.dark` class on `<html>` directly (via `MutationObserver`), not `next-themes`' `useTheme()` - this app has no `next-themes` `ThemeProvider` mounted, so `useTheme()` was silently falling back to the OS `prefers-color-scheme` instead of the app's actual theme. That was a real, reproducible bug (confirmed by forcing the OS scheme and the app's own theme out of sync: the toast rendered with the wrong-mode colors while everything else on screen was correct) - fixed by reading the same class the rest of the app's styling already keys off of.
- **Usage discipline:** toasts fire for errors always, and for successful creates/deletes/updates that a user wouldn't otherwise get visible confirmation of. They do **not** fire for actions that already have their own visible state change (checking off a task, logging a habit) - that was a real bug fixed this session (toast-per-checkbox-tap was pure noise on the app's highest-frequency actions).

### Named Modals
All modals share the base Dialog/glass treatment (see Dialogs / Modals below), but each has a distinct content shape worth naming:
- **TaskModal / HabitModal / EventModal:** the three creation/edit forms. Fields stagger in on open (0.05s cadence) rather than mounting as one block; inputs get a focus-glow ring rather than the bare default.
- **ConfirmDialog:** the single shared destructive-confirmation surface (delete task, delete tag, delete habit all route through it) - `AlertDialog`-based rather than a plain `Dialog`, since it needs to trap focus and block outside dismissal for a real safety net. `variant="destructive"` gets a spring-scaled `AlertTriangle` icon as a visual severity signal; the default variant does not.
- **UpgradeAccountModal:** the one conversion-relevant modal (guest → real account). Gets extra polish relative to other modals - a bouncier spring entrance (`cubic-bezier(0.34, 1.56, 0.64, 1)` rather than the standard expo-out) and a brand-tinted glow on the primary CTA, since this is the app's one moment doing persuasive work inside an otherwise strictly-Operate surface.

### Calendar
Three view modes - Month / Week / Agenda - switched via a pill-style toggle, all recurring-task-aware (a recurring task's individual occurrences render on their actual dates, not just the parent task's start date). The "today" marker and the selected-date indicator use a `layoutId`-shared element so the marker visibly springs/glides between cells rather than jump-cutting when the selection changes or the view switches.

**Today's Flow** (Agenda view only): a vertical timeline of today's real scheduled items - tasks with a `due_time` plus events with a `start_time`, merged and sorted chronologically - with a live "Now" row inserted at its actual position among them (computed from the real current time on each render, not a fixed pixel-position line, which would need a day-window assumption this app doesn't have). Renders nothing when today has no timed items, rather than an empty or fabricated placeholder. Deliberately does not include a focus-mode toggle, a deep-work-quota tracker, or any time-tracking metric - the app has no such feature, so the timeline never implies one.

### Charts & Heatmap (Progress & Analytics)
- **Bar chart:** Recharts, styled to the neutral palette only (no default Recharts color scheme) - bars grow in on mount, gated to only start that animation once the chart is actually scrolled into view (mounting it off-screen would let the grow-in animation finish before a user ever sees it).
- **Activity heatmap:** not a chart library - hand-built grid of cells, each cell's opacity computed from a normalized 0-1 intensity value (`Math.min(day.count / 5, 1)`, floored at `0.12` so a zero-activity day is still a visible cell rather than invisible), filled with `hsl(var(--primary) / opacity)` so it re-themes automatically between light and dark mode instead of needing a separate dark-mode heatmap palette.

### Landing Demo Component Library
The marketing site's core credibility technique: every feature claim is backed by a small, real, working recreation of the actual product UI (built from the same primitives as the real app), never a static screenshot or an invented mockup. Named instances: `AIShowcase` (a typewriter-animated Quick Add demo plus an Accept/Dismiss AI Suggestions demo), `SyncDiagram` (an animated bidirectional-pulse diagram of the Google/Microsoft sync relationship), `RecurringDemo` (a week-strip showing per-occurrence completion), `AnalyticsPreview` (a scaled-down real chart + heatmap), `StepDemos` (three per-step mini product recreations inside the sticky-stack), `FeatureDetailGrid` (the tabbed granular-feature grid). The GSAP sticky-stack (`StepsStack`) is the one scroll-hijacking moment on the whole page - capped at exactly one per page by policy, pinning each step at 92% viewport height on desktop and collapsing to a plain vertical stack (no pinning at all) below `md`, gated by `gsap.matchMedia()`.

### Ambient Backgrounds & Grain
Two atmospheric techniques, marketing-site only:
- **Ambient blobs:** large (18-26rem), heavily blurred (`blur-3xl`), extremely low-opacity (`foreground/[0.03]` to `foreground/[0.08]`) circles that drift slowly (`y` animation, 14-16s loop) behind hero and CTA content. Never used in the app interior - Operate-mode surfaces stay visually quiet.
- **Grain overlay:** a fixed, full-viewport, `pointer-events-none` SVG `feTurbulence` filter at `opacity-[0.035]` with `mix-blend-overlay`, applied once at the page root - never on a scrolling container (continuous repaint there would tank mobile frame rate). Breaks up flat dark surfaces without reading as visible texture.

## Do's and Don'ts

### Do:
- **Do** keep the palette strictly monochrome plus the one destructive red; route any new "this needs to stand out" impulse through weight, scale, or motion instead of a new color.
- **Do** use Space Grotesk only at real display scale; Geist for everything else.
- **Do** check every new animated component against `prefers-reduced-motion` as part of building it, not as a follow-up pass.
- **Do** keep the app interior's radius scale (8/6/4px) and the marketing site's (16/24px + pills) separate; never mix them within one surface.
- **Do** use the tinted-shadow and glass techniques only for genuinely elevated/floating elements, never as ambient decoration on resting content.
- **Do** give every destructive action (delete, especially via a gesture) a real confirmation step.
- **Do** use real, working component previews (built from the app's actual primitives) for any marketing demo - never a fake/static screenshot mockup.

### Don't:
- **Don't** introduce a second accent color anywhere in the app interior or marketing site.
- **Don't** default to Inter for new text - it's the single most common AI-generated-interface tell this system was explicitly built to move away from.
- **Don't** apply glassmorphism to primary content surfaces (page bodies, main list/grid backgrounds) - it's reserved for modals, popovers, and drawer scrims.
- **Don't** add motion that isn't motivated by hierarchy, storytelling, feedback, or a state transition - "it looked cool" is not a reason, and every animation in this system can be justified in one sentence.
- **Don't** use a flat CSS `ease` for anything that should feel physical (buttons, drag, toggles) - reach for the spring contract instead.
- **Don't** use an em-dash anywhere in shipped copy.
- **Don't** repeat a page's title twice (once in a persistent header, once again in the page body) - the app interior standardized on the top bar owning the one `<h1>` after this exact redundancy was found and removed across five views.
- **Don't** reopen the tag color picker to arbitrary/saturated colors without also deciding what happens to the grayscale-vs-legacy-color inconsistency already present in the running app.
- **Don't** fire a toast for an action that already has its own visible state change (a checkbox, a completed row) - reserve toasts for outcomes the user has no other way to confirm.
- **Don't** ship a second scroll-hijacked/pinned section on the landing page - one GSAP sticky-stack per page is the cap.
