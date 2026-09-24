---
name: chocolate.lottery
description: The office side game that decides who gets the chocolate, packaged as a wrapped bar you tear open to play.
colors:
  gold-foil: "#F3CF6E"
  gold-foil-hover: "#F7DA8A"
  gold-deep: "#D9A43A"
  amber: "#E8A93A"
  amber-dot: "#D9901E"
  winner-gold: "#FFD24A"
  wrapper-night: "#16051D"
  wrapper-soft: "#22092C"
  wrapper-panel: "#1E0827"
  wrapper-panel-2: "#2A0F35"
  wrapper-plum: "#2E0F3A"
  ink-on-gold: "#2A0B35"
  paper-cream-text: "#F3E7CE"
  text-mute: "#C8B6A0"
  text-dim: "#9A8497"
  wrapper-back-cream: "#EFE2C8"
  cocoa-ink: "#3A1D0D"
  foil-silver: "#C9CED4"
  success-green: "#3FBF8C"
  alert-red: "#F0625A"
typography:
  display:
    fontFamily: "'Archivo Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3rem, 7.4vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "'Archivo Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.6rem, 2.6vw, 2.1rem)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 118"
  title:
    fontFamily: "'Archivo Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 2.6vw, 1.9rem)"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 125"
  body:
    fontFamily: "'Archivo Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "'Archivo Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.16em"
  lot-code:
    fontFamily: "'Doto Variable', ui-monospace, monospace"
    fontSize: "1.2rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  print: "3px"
  sm: "6px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "8px"
  md: "16px"
  band: "18px"
  panel: "22px"
  section: "clamp(56px, 9vw, 112px)"
components:
  tear-strip:
    backgroundColor: "{colors.gold-foil}"
    textColor: "{colors.ink-on-gold}"
    typography: "{typography.title}"
    rounded: "{rounded.print}"
    padding: "0 20px 0 28px"
    height: "92px"
    width: "100%"
  button-primary:
    backgroundColor: "{colors.gold-foil}"
    textColor: "{colors.ink-on-gold}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
  button-primary-hover:
    backgroundColor: "{colors.gold-foil-hover}"
  button-on-cream:
    backgroundColor: "{colors.wrapper-plum}"
    textColor: "{colors.gold-foil}"
    rounded: "{rounded.print}"
    padding: "12px 22px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-mute}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.wrapper-soft}"
    textColor: "{colors.paper-cream-text}"
  preset-on-cream:
    backgroundColor: "transparent"
    textColor: "{colors.cocoa-ink}"
    rounded: "{rounded.print}"
    padding: "9px 14px"
  preset-on-cream-active:
    backgroundColor: "{colors.cocoa-ink}"
    textColor: "{colors.wrapper-back-cream}"
  input-text:
    backgroundColor: "{colors.wrapper-soft}"
    textColor: "{colors.paper-cream-text}"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
  chip:
    backgroundColor: "{colors.wrapper-panel}"
    textColor: "{colors.text-mute}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  facts-label:
    backgroundColor: "{colors.wrapper-back-cream}"
    textColor: "{colors.cocoa-ink}"
    rounded: "2px"
    padding: "16px 18px 14px"
  lot-band:
    backgroundColor: "{colors.wrapper-panel-2}"
    textColor: "{colors.paper-cream-text}"
    rounded: "{rounded.print}"
    padding: "14px 20px"
  panel:
    backgroundColor: "{colors.wrapper-panel}"
    textColor: "{colors.paper-cream-text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.panel}"
---

# Design System: chocolate.lottery

## Overview

**Creative North Star: "The Wrapper"**

The app is a wrapped chocolate bar, and you open it to play. The front of the wrapper is the first screen: silver foil crimps at both ends, a drenched aubergine sleeve of uncoated paper, an enormous gold wordmark blocked into it, packaging micro-copy printed in the corners, and a single perforated gold tear strip as the only action. Scrolling turns the bar over to its back, where the facts label and the lot bands of past rounds are printed in cream and cocoa. The game room, the chocolate bars and the leaderboard sit on the same wrapper paper.

The palette works like real packaging print: one paper colour everywhere, foil used sparingly, and ink that changes with the surface it sits on (cream on aubergine, aubergine on gold, cocoa on cream). Type is one extended heavy grotesque at two extremes. Enormous wide blacks carry the name and the action, and tiny tracked capitals carry the packaging copy. Lot codes are the only other voice, printed in an inkjet dot-matrix face.

It moves like stop-motion. Authored moments (the tear strip ripping, the bars unwrapping, the ticket lifting) advance in discrete `steps()` frames and never tween between two poses. The rejected alternative is a gradient party-game hero with cards. The app has its own identity, not MOVION's. MOVION branding appears only on date-gated event pieces.

**Key Characteristics:**
- Drenched aubergine wrapper paper as the only ground, with print grain and a left-lit falloff on the sleeve.
- Gold foil rationed to the wordmark, the one primary action and winners.
- Flat silver foil ends drawn as crimp ridges with a serrated cut edge.
- Cream wrapper-back panels printed in cocoa ink for facts and settings.
- Archivo on its width axis: extended 900 display, tiny tracked uppercase labels.
- Doto dot-matrix for game codes, lot stamps and dates.
- Stop-motion motion grammar: authored moments advance in steps(), not eases.

## Colors

Packaging print: a drenched aubergine paper, one flat gold foil, a silver foil, and inks that change with the surface they print on.

### Primary
- **Gold Foil** (gold-foil): The wordmark, the tear strip, the primary button, winner names in lot bands, focus outlines, selection, links. It is flat foil with nothing glossy on it. Hover lifts it to Gold Foil Hover.
- **Deep Gold** (gold-deep): The tear strip's pull tab, a darker stamping of the same foil. Used only as a second tone inside gold objects.
- **Winner Gold** (winner-gold): The reveal only (winning straw, ticket glow). It never appears at rest.

### Secondary
- **Working Amber** (amber): The working accent for state rather than identity: input focus border, active chip and active ghost-button borders, over a 14% amber wash.
- **Wordmark Dot Amber** (amber-dot): The full stop in "chocolate.lottery", and nothing else.

### Neutral
- **Wrapper Night** (wrapper-night): Page ground, theme-color, the back of the bar.
- **Wrapper Soft / Panel / Panel 2** (wrapper-soft, wrapper-panel, wrapper-panel-2): Tonal layers of the same paper for inputs, panels and lot bands, darkest to lightest.
- **Wrapper Plum** (wrapper-plum): The bar's own wrapper colour. The in-game bar is drawn in it, and it is the only button fill allowed on cream.
- **Paper Cream Text** (paper-cream-text): Body text on aubergine. **Text Mute** and **Text Dim** step it down for secondary copy and stamps.
- **Ink on Gold** (ink-on-gold): Everything printed on gold foil.
- **Wrapper-Back Cream** (wrapper-back-cream) with **Cocoa Ink** (cocoa-ink): The inside and back of the wrapper (facts label, the tear-strip interior). Cocoa is the only ink on cream.
- **Foil Silver** (foil-silver): The foil ends (ridges in #DADDE2 / #B3B9C0 / #C9CED4) and dot-matrix lot codes.
- **Success Green / Alert Red** (success-green, alert-red): Status only. On cream, the error colour darkens to #A3261E.

### Named Rules
**The Rationed Foil Rule.** Gold goes on the name, the one action per screen, and winners. If a second gold object competes with the primary action on a screen, one of them is wrong.

**The Ink Follows Surface Rule.** Aubergine carries cream text. Gold carries aubergine ink. Cream carries cocoa ink, plus plum for its single action. Never print gold text on cream, or cream text on gold.

**The Borders Are Foil Rule.** Hairlines on aubergine are gold at low alpha (18% rest, 38% hover, 9% soft dividers), never grey.

## Typography

**Display Font:** Archivo Variable, self-hosted with its width axis (fallback ui-sans-serif, system-ui)
**Body Font:** Archivo Variable
**Label/Mono Font:** Doto Variable for lot codes and stamps (fallback ui-monospace). The system mono stack remains for in-game code stamps and ranks.

**Character:** A single extended heavy grotesque, set as large as it will go or as small as a packaging label. The dot-matrix face reads as the inkjet date code on the flap of a real bar.

### Hierarchy
- **Display** (900, width 125%, clamp(3rem, 7.4vw, 6rem), line-height 0.95): The wordmark only. On phones the width narrows to 108% and the two words stack.
- **Headline** (900, width 112 to 118%, clamp(1.6rem, 2.6vw, 2.1rem)): Section titles on the back of the wrapper ("Recent rounds", "Draw facts" at 2.35rem). Page titles in the app shell use the same weight and width at 2.4rem, in gold.
- **Title** (500 verb + 900 action, width 125%, uppercase, clamp(1.25rem, 2.6vw, 1.9rem)): The tear strip label. One line, one face, with weight doing the emphasis.
- **Body** (400, 15px root, line-height 1.5): Everything else. Claims are capped near 36ch.
- **Label** (600 to 700, uppercase, 0.14 to 0.2em tracking): Packaging micro-copy, corner navigation, table heads, prize names. Keep it at 0.75rem (about 11px) or larger.
- **Lot code** (Doto 800, 1.2rem, 0.04em): Game codes in silver. Date and time stamps use Doto 700 at 0.82rem in text-dim.

### Named Rules
**The Two Extremes Rule.** Type is either packaging-display (900, extended, tight tracking) or packaging-label (small, uppercase, widely tracked). Emphasis inside one line comes from weight, never from a second family.

**The Stamp Face Rule.** Doto is only for machine-printed data: codes, dates, times. Never use it for prose or headings.

## Layout

The homepage is two faces of one object. The front (`bar-front`) is exactly one viewport tall (100svh): a foil end, the sleeve, and another foil end. The sleeve content is centred, with a double gold rule inset clamp(12px, 2vw, 22px) from its edges, and micro-copy is pinned to the four corners. The tear strip runs the full width between the rules. The back is a 1240px-max two-column grid (facts label 280 to 360px, lot bands filling the rest) with section padding of clamp(56px, 9vw, 112px). It collapses to one column below 900px.

The game room is a viewport-fitted three-column grid at 1100px and up (300px snacks, stage, 300px chat), with no page scroll. The event layout drops the snacks column and gives the stage the width. Below 1100px on event day, the phone screen is the stage: 100dvh, no page scroll, and chat becomes a floating bubble plus a bottom drawer. Bars are sized to the stage by measurement (fitShelf), not by head count. The stage clips and only scrolls inside itself when even the smallest bar cannot fit.

Rhythm: 8px between sibling controls, 16px between panels, 18px inside wrapper bands and corner clusters, 22px panel padding.

## Elevation & Depth

Depth comes from print and foil. There are no floating surfaces. Paper is flat and printed, and it gets its body from a left-lit gradient (#1E0726 to #3B1549 to #2E0F3A to #170420), a fractal-noise grain at 6%, and inset shade where the foil crimps meet it. Foil objects on the paper (the tear strip, the cream inside, the wordmark) cast one soft, low, diffuse drop, as if the foil sits a hair above the sleeve. Lot bands are flat with a gold hairline inset top and bottom.

### Shadow Vocabulary
- **Foil drop** (`box-shadow: 0 12px 26px -6px rgba(0,0,0,0.5)`): The tear strip and the cream inside under it. On hover it deepens to `0 18px 32px -8px rgba(0,0,0,0.55)`.
- **Blocked wordmark** (`text-shadow: 0 3px 10px rgba(0,0,0,0.35)`): Gold display type pressed into paper.
- **Crimp shade** (`box-shadow: inset 0 14px 22px -14px rgba(0,0,0,0.7), inset 0 -14px 22px -14px rgba(0,0,0,0.7)`): Where the sleeve runs under the foil ends.
- **Band edge** (`box-shadow: inset 0 1px 0 rgba(243,207,110,0.22), inset 0 -1px 0 rgba(243,207,110,0.12)`): Lot bands.
- **Panel** (`--shadow-1: 0 1px 2px rgba(0,0,0,0.3), 0 8px 20px rgba(0,0,0,0.22)`): Game-room and leaderboard panels.

### Named Rules
**The Flat Foil Rule.** Foil is flat colour with, at most, one soft drop beneath it. No gloss highlights and no metallic gradients across gold.

## Shapes

Packaging corners are nearly square. Anything that is part of the wrapper (tear strip, pull tab, cream inside, lot bands, presets and the button on cream) takes a 3px print corner. The facts label is 2px with a 2px cocoa border, and the sleeve's gold double rule is 4px outside and 2px inside. App chrome inherited by the game room keeps softer corners: 6px for buttons and inputs, 16px for panels. Leaderboard month chips are the only pills.

The recurring silhouettes are packaging cuts. Serrated triangle edges (a 14 x 7 SVG tooth) finish the foil ends. Dashed 2px perforations run 7px inside the tear strip's long edges. A ragged zig-zag paper edge shows while the strip rips.

## Components

### Tear Strip (signature)
The page's one action, as a gold perforated strip.
- **Shape:** full width, 92px tall (84px on phones), 3px corners, dashed perforations top and bottom in ink at 34%.
- **Content:** "Pull to" at 500 and the action at 900 on one uppercase line, plus a 52px Deep Gold pull tab with a drawn arrow at the right end.
- **Hover / Focus:** lifts 2px with a -0.35deg tilt, and the tab slides 5px toward the pull, over 0.25s cubic-bezier(0.22, 1, 0.36, 1). Focus draws a 3px cream outline 4px out.
- **Motion:** on press it rips from the tab end in 7 frames (`steps(7, end)`, 0.56s): a right-to-left clip-path cut with a cream zig-zag edge riding the cut. The cream inside is already laid out underneath, so the page never shifts. Under reduced motion it opens instantly.

### Buttons
- **Shape:** 6px corners in app chrome, 3px on wrapper surfaces.
- **Primary:** flat Gold Foil with Ink on Gold at 700 weight, 9px 16px (12px 22px when large), a faint inset top highlight and a soft drop. Hover lightens to Gold Foil Hover. Press moves it down 1px.
- **On cream:** Wrapper Plum with gold text at width 115%, 12px 22px, hover #3B1549. This is the only filled button inside the wrapper.
- **Ghost:** transparent with a gold hairline and muted text. Hover fills with Wrapper Soft. Active state takes the amber wash and amber border.
- **Focus:** 2px gold outline, 2px offset, app-wide. On cream it switches to a plum outline.

### Presets on Cream
Radio-style option buttons printed on the wrapper's inside: 1.5px cocoa border at 35%, cocoa 700 tabular numerals. Active fills solid cocoa with cream text.

### Chips
Leaderboard month filters: Wrapper Panel pill, gold hairline, muted 600 text. Active takes the amber wash, an amber border and gold text.

### Cards / Containers
- **Facts label:** a nutrition-facts panel. Cream, 2px cocoa border, 1px cocoa row rules, 9px heavy rules between blocks, 3px rules before major rows, tabular numerals, 800-weight values.
- **Lot band:** one past round per band. Dot-matrix code, stamp date and time, gold winner name (800, width 112%), "1 in N" odds, and the prize as a tracked label. On phones it reflows to a two-column grid.
- **Panel (app shell):** Wrapper Panel, gold hairline border, 16px radius, 22px padding, panel shadow.

### Inputs / Fields
Wrapper Soft fill, gold hairline, 6px corners, 9px 12px. Focus switches the border to amber, lifts the fill to Wrapper Panel 2 and adds a 3px amber-wash ring. Placeholders use Text Dim.

### Navigation
The homepage has no nav bar. Links are packaging copy printed in the sleeve's corners: tracked uppercase with a gold underline at 35% that turns full gold on hover. The app shell uses ghost buttons with drawn SVG arrows.

### Chocolate Bar (in-game)
A single SVG bar drawn at nine unwrap steps in Wrapper Plum, gold and cream. The idle "boil" is three poses at about 5fps (`steps(1)`), a torn scrap flies off over 9 frames, and the ticket glow runs in 3 steps. Its MOVION wrapper is an event piece, not part of the app's identity.

## Do's and Don'ts

### Do:
- **Do** keep gold for the wordmark, the one primary action per screen, and winners (the Rationed Foil Rule).
- **Do** print cocoa on cream, aubergine on gold and cream on aubergine (the Ink Follows Surface Rule).
- **Do** move authored moments in `steps()` frames: the 7-frame rip, the 9-step unwrap, and the 3-step ticket glow. Plain hover and state feedback may still ease over 0.15 to 0.25s.
- **Do** set Doto only on machine-printed data (codes, dates, times).
- **Do** draw icons as inline SVG strokes (2.2 to 2.4 width, round caps), like the arrows and chevrons.
- **Do** fit event-day screens to the viewport (100svh front, 100dvh phone stage) and size bars by measuring the stage.
- **Do** keep tracked packaging labels at 0.75rem or larger.

### Don't:
- **Don't** build the gradient party-game hero with cards. The first screen is the wrapper.
- **Don't** put gloss or metallic gradients on gold foil. Lighting gradients belong to the paper only.
- **Don't** apply MOVION branding to the app itself. It stays on date-gated event pieces (golden ticket art, the Toblerone prism, the bar wrapper).
- **Don't** add kickers or eyebrow labels above headings. Packaging micro-copy lives in the sleeve corners, not stacked over titles.
- **Don't** use emoji or font glyphs as icons.
- **Don't** print gold text on cream, or put a second filled button inside the wrapper's inside.
