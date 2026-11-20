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
export type SoundName = 'playKnock' | 'playCreak' | 'playSpookyStinger' | 'playSparkleChime' | 'playPartyPopper' | 'playTada' | 'playSleighBells';

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

/** Words for the trick-or-treat feature. Having this on a theme turns the feature on:
 *  trick votes in the lobby and the door at the reveal. The winner never chooses
 *  a door (see lib/trickOrTreat.ts). `intro` may use {odds}. */
export interface TrickOrTreatCopy {
  title: string;
  intro: string;
  /** One line for the compact lobby version. May use {odds}. */
  hint: string;
  placeholder: string;
  empty: string;
  knocking: string;
  treat: string;
  trickLead: string;
  trickNote: string;
}

/** A guest who turns up at the reveal (Santa, at Winter): a figure that comes up
 *  in the corner of the stage and says a line to the winner, and something that
 *  flies across the stage dropping confetti as the name lands. Having this on a
 *  theme turns it on; it never changes who wins. Both images are URLs (import
 *  them with `?url`), so they only load on a theme that uses them. */
export interface RevealCameo {
  figure: {
    /** An SVG made of <path> elements. */
    src: string;
    /** Indices of the paths that wave together, and the point they turn around,
     *  in the SVG's own units (Santa's glove, from the wrist). */
    wave?: number[];
    pivot?: [number, number];
    label: string;
  };
  /** A silhouette, drawn in gold as it crosses the stage. */
  flyer?: { src: string; label: string };
  /** The speech bubble. `{name}` is the winner. */
  line: string;
  /** On the winner's own screen. */
  lineForWinner?: string;
}

/** Words for the advent calendar (lib/advent.ts). Having this on a theme turns the
 *  calendar on while that theme is live: each win opens the next door. `{door}`
 *  is a door number, `{n}` a count. */
export interface AdventCopy {
  /** The calendar's name, on its page and links. */
  title: string;
  /** Under the title on its page. */
  intro: string;
  /** Lobby: the door this round will open. */
  lobbyNext: string;
  /** Lobby, when more than one door is waiting today. */
  lobbyWaiting: string;
  /** Reveal: above the prize behind the door. */
  revealLead: string;
  /** A door whose prize has not been named yet. */
  surprise: string;
  /** Before the first door, while the teaser runs (/admin): the lobby line.
   *  `{date}` is the day the first door opens. */
  teaserLobby: string;
  /** Teaser, at the reveal: the card's lead and its countdown (`{n}` days). */
  teaserLead: string;
  teaserIn: string;
  teaserTomorrow: string;
  /** Teaser: the sign over the first door in the calendar street. */
  teaserSign: string;
}

export interface Theme {
  id: string;
  label: string;
  copy: Copy;
  /** Trick or treat, off unless a theme provides its words. */
  trickOrTreat?: TrickOrTreatCopy;
  /** Show each player's random costume emoji as their avatar. */
  costumes?: boolean;
  effects: Effects;
  sounds: {
    /** Plays as the reveal drumroll starts. */
    revealStart?: SoundName;
    /** Plays when the winning bar lights up. */
    barLit?: SoundName;
  };
  /** Extra shapes printed on every bar's sleeve (drawn above the lettering). */
  barPrint?: (g: BarPrintGeometry) => PrintItem[];
  /** A guest at the reveal. */
  cameo?: RevealCameo;
  /** The advent calendar, on while this theme is live. */
  advent?: AdventCopy;
}

/** An event: a partial override of the default theme, plus when it runs. */
export interface EventTheme {
  id: string;
  label: string;
  /** Inclusive `YYYY-MM-DD` in Europe/Amsterdam. Leave out for a theme that only
   *  switches on by `?theme=<id>` or the THEME env var (never by date). */
  window?: { from: string; to: string };
  copy?: Partial<Copy>;
  trickOrTreat?: TrickOrTreatCopy;
  costumes?: boolean;
  effects?: Partial<Effects>;
  sounds?: Theme['sounds'];
  barPrint?: Theme['barPrint'];
  cameo?: RevealCameo;
  advent?: AdventCopy;
}
