---
name: PageCourier
description: A quiet, precise visual system for carrying Markdown toward a shareable page.
colors:
  ink: '#152c39'
  muted-ink: '#52646b'
  surface: '#f7f8f3'
  surface-muted: '#e8eeea'
  line: '#c5d0ca'
  blue: '#1c596c'
  lime: '#d7f05b'
  journey-muted: '#d5e0dc'
  journey-rule: '#61747a'
  journey-caption-rule: '#50636b'
  paper-fold: '#c8d2cc'
  paper-line: '#99a8a4'
  link-caption: '#f1f3ea'
  journey-orbit: 'rgb(247 248 243 / 18%)'
  status-error: '#8d2923'
typography:
  display:
    fontFamily: "'Helvetica Neue', Helvetica, 'Segoe UI', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'"
    fontSize: '4.5rem'
    fontWeight: 750
    lineHeight: 0.99
    letterSpacing: '-0.04em'
  body:
    fontFamily: "'Helvetica Neue', Helvetica, 'Segoe UI', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'"
  label:
    fontFamily: "'Helvetica Neue', Helvetica, 'Segoe UI', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'"
    fontSize: '0.72rem'
    fontWeight: 700
    letterSpacing: '0.12em'
---

# Design System: PageCourier

## Overview

**Creative North Star: "A Quiet Route for Words"**

PageCourier's visual language is editorial and restrained: a mineral-green canvas, dark ink, and a small signal-lime accent make a simple file-to-page route the defining graphic. A single sans-serif family, tight headline setting, fine rules, and generous open space keep the page precise without making it feel technical or form-driven.

The route diagram is a flat illustration, not an interactive control. Its paper, dotted transfer line, and link symbol express the visual idea of one file becoming one page to share; keep that drawing calm and legible rather than adding interface chrome around it.

**Key Characteristics:**

- Restrained mineral, ink, and lime palette
- One precise sans-serif family across display and interface text
- Flat surfaces with fine separators and a route-marked diagram
- Left-led editorial content balanced by a compact visual schematic

## Colors

The palette pairs a deep ink-navy foundation with cool mineral neutrals and a concentrated signal-lime accent; blue-green supports secondary emphasis.

### Primary

- **Ink Navy** (`{colors.ink}`): Main foreground and the dark field behind the route diagram.
- **Signal Lime** (`{colors.lime}`): High-contrast accent for the route endpoint, small note marker, and selection highlight.
- **Blue Green** (`{colors.blue}`): Secondary emphasis for paper detail, links, focus outlines, and non-error status text.

### Neutral

- **Soft Paper** (`{colors.surface}`): Main reading surface and the paper illustration.
- **Mineral Canvas** (`{colors.surface-muted}`): Page background and muted fold detail.
- **Quiet Ink** (`{colors.muted-ink}`): Supporting copy, header note, and footer text.
- **Mineral Line** (`{colors.line}`): Fine page-level dividers.
- **Journey Mist** (`{colors.journey-muted}`): Supporting text within the dark schematic.
- **Slate Route Rule** (`{colors.journey-rule}`): The schematic's thin horizontal guide.
- **Deep Route Divider** (`{colors.journey-caption-rule}`): The schematic caption separator.
- **Fold Stone** (`{colors.paper-fold}`): Light half of the paper-corner fold.
- **Paper Rule** (`{colors.paper-line}`): Secondary document lines.
- **Pale Caption** (`{colors.link-caption}`): Link caption against the dark schematic.
- **Faint Orbit** (`{colors.journey-orbit}`): Low-contrast partial circle at the diagram edge.
- **Status Error** (`{colors.status-error}`): Error message text and its outlined status mark.

## Typography

**Display Font:** Helvetica Neue, with Helvetica, Segoe UI, Arial, and sans-serif fallbacks  
**Body Font:** The same sans-serif stack, followed by platform emoji fallbacks

**Character:** Clean, compact, and direct. Weight and tight tracking give the headline presence; supporting copy and small tracked labels keep the schematic readable and orderly.

### Hierarchy

- **Display** (weight 750, 4.5rem, line-height 0.99, letter-spacing -0.04em): The single large, left-aligned page headline.
- **Body** (shared sans-serif stack): Supporting copy uses a relaxed 1.6 line-height; the lead is 1.15rem on wider screens and 1.05rem on narrow screens.
- **Label** (weight 700, 0.72rem, letter-spacing 0.12em): Uppercase route labels; smaller step labels use the same tracked, bold treatment.
- **Brand** (weight 750, 1.05rem, letter-spacing -0.025em): Compact wordmark alongside its square document icon.

## Layout

The desktop frame is centered and capped at 76rem, with 1.5rem outer gutters. The first-view composition uses an asymmetric two-column intro: copy on the left and a dark route diagram on the right, with a 4rem gap. Header and footer align to the same frame and use fine horizontal rules.

At 800px and below, the frame narrows to a maximum of 42rem with 1.25rem gutters, and the intro becomes one column with the diagram following the copy. At 480px and below, the frame uses 1rem side gutters; the diagram's internal spacing and illustration scale tighten, and the footer may wrap. The page maintains a 320px minimum viewport width.

## Elevation & Depth

The system is flat: there are no shadows. Depth comes from the contrast between the mineral canvas, soft-paper illustration, and ink diagram, with fine borders, a folded paper corner, dotted route, and a faint partial circle supplying restrained graphic detail.

## Shapes

The page and diagram are square-cornered and rely on color blocks and thin rules rather than rounded cards. Rounded geometry is reserved for the brand icon, circular note marker, and circular link mark; the paper illustration has a clipped-looking folded corner. No shared radius scale is defined.

## Components

### Brand lockup

- Pair the compact document glyph with the bold wordmark; the glyph uses a lime tile, ink paper shape, and light document lines.
- Keep the descriptor aligned opposite the lockup in muted text; it becomes right-aligned and width-constrained on narrow screens.

### Journey diagram

- Use a dark, flat panel with a tracked “one file / one link” topline, a paper source, a lime dotted transfer arrow, and a circular link endpoint.
- Keep step labels small, uppercase, and tracked. Separate the short caption with a fine rule.
- The diagram is illustrative, not a button, upload field, or other control.

### GitHub project link

- Place an icon-only GitHub link beneath the introductory copy, using a muted-ink mark and an ink hover state.
- Give the link the accessible name “PageCourier on GitHub”; keep the SVG decorative to assistive technology.

### Status message

- The shared status pattern is a compact horizontal message with a 1.35rem outlined circular mark, 0.95rem text, and 1.5 line-height.
- Standard status text and its mark use blue-green; error text and its mark use the dedicated status-error color.

### Skip link

- Keep the skip link out of view until focused; its focused treatment is an ink background, light text, and visible blue-green keyboard focus outline.

## Do's and Don'ts

### Do:

- **Do** preserve the single sans-serif family and the ink, mineral, lime, and blue-green roles.
- **Do** use fine rules, color contrast, and the flat route illustration to establish hierarchy instead of elevation.
- **Do** stack the copy and schematic at the established 800px breakpoint and retain the compact diagram treatment below 480px.

### Don't:

- **Don't** add shadows or rounded-card styling to the page frame or journey panel.
- **Don't** turn the static file-to-link schematic into an implied upload control.
- **Don't** introduce a second display typeface or extra accent colors without a demonstrated need in the existing system.
