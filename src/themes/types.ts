// Theme system types. A *theme* is the complete look of the app; the default
// theme (default.ts) states every value, and an *event theme* (halloween.ts, …)
// is a partial override merged on top of it, so removing an event can never
// leave a hole. See resolve.ts for how one gets picked and index.ts for the list.

/** Every swappable string. Keys are stable; event themes override a subset. */
export interface Copy {
  'landing.claim': string;
  'landing.cornerRight': string;
  'landing.footer': string;

  'reveal.beatOpen': string;
  'reveal.beatTicket': string;
  /** Printed above the bar number: "<headline> bar Nº 01". */
  'reveal.headline': string;
  'reveal.winnerMsg': string;
  'reveal.hostMsg': string;
  'reveal.guestMsg': string;
  /** Straw mode's reveal (bar mode uses the 'reveal.*' lines above). */
  'reveal.strawHeadline': string;
  'reveal.strawWinnerMsg': string;
  'reveal.strawGuestMsg': string;

  'unwrap.suspense': string[];
  'unwrap.allOpen': string;
  'unwrap.allHaveBar': string;

  'snacks.title': string;
  'snacks.cupboardBtn': string;
  /** A small glyph before each snack suggestion and quick-pick chip. Empty = none. */
  'snacks.itemIcon': string;
  'cupboard.title': string;

  /** The two small lines printed on the bar's sleeve. */
  'bar.tagline1': string;
  'bar.tagline2': string;
}
export type CopyKey = keyof Copy;

/** What the confetti canvas throws. */
export interface Effects {
  confettiColors: string[];
  emojiGlyphs: string[];
  /** Emoji lobbed up with the confetti: [normal, big win]. */
  emojiBurst: [number, number];
  fireworkPalettes: string[][];
  sparkleColors: string[];
  tearColors: string[];
  /** When set, these glyphs drift up the screen alongside the tears. */
  tearGlyphs?: string[];
  tearGlyphCount?: number;
}

/** Names of the sound functions in lib/sound.ts that a theme may trigger. */
export type SoundName = 'playCreak' | 'playSpookyStinger' | 'playSparkleChime' | 'playPartyHorn' | 'playTada';

/** One drawn shape printed on a bar's sleeve. 'gold' means the sleeve's gold foil. */
export interface PrintItem {
  d: string;
  transform?: string;
  fill?: string;
  /** 'evenodd' lets one path carry cut-outs (a jack-o'-lantern's face). */
  fillRule?: 'nonzero' | 'evenodd';
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}
export interface BarPrintGeometry {
  /** The sleeve rectangle, in the bar SVG's own units (viewBox 0 0 200 350). */
  sleeve: { x: number; y: number; w: number; h: number };
}

export interface Theme {
  id: string;
  label: string;
  copy: Copy;
  effects: Effects;
  sounds: {
    /** Plays as the reveal drumroll starts. */
    revealStart?: SoundName;
    /** Plays when the winning bar lights up. */
    barLit?: SoundName;
  };
  /** Extra shapes printed on every bar's sleeve (drawn above the lettering). */
  barPrint?: (g: BarPrintGeometry) => PrintItem[];
}

/** An event: a partial override of the default theme, plus when it runs. */
export interface EventTheme {
  id: string;
  label: string;
  /** Inclusive `YYYY-MM-DD` in Europe/Amsterdam. Leave out for a theme that only
   *  switches on by `?theme=<id>` or the THEME env var (never by date). */
  window?: { from: string; to: string };
  copy?: Partial<Copy>;
  effects?: Partial<Effects>;
  sounds?: Theme['sounds'];
  barPrint?: Theme['barPrint'];
}
