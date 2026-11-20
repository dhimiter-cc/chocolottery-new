// Advent calendar bits that both the server and the browser use. The street itself
// is worked out on the server (lib/adventStreet.ts).

/** How many doors the advent calendar has (1 to 24 December). */
export const DOORS = 24;

/** The canal skyline along the bottom of the calendar. */
export const CANAL_PATH =
  'M0 120V64H40V40H52V30H64V40H76V64H110V36L136 14L162 36V64H200V44Q200 30 214 28Q222 10 236 10Q250 10 258 28Q272 30 272 44V64H310V30H322V20H346V30H358V64H400V40L430 16L460 40V64H500V34H512V24H524V14H548V24H560V34H572V64H620V42Q620 30 632 28Q640 12 654 12Q668 12 676 28Q688 30 688 42V64H730V38L756 18L782 38V64H820V30H832V20H856V30H868V64H910V44H922V32H946V44H958V64H1000V40L1028 16L1056 40V64H1100V36H1112V24H1136V36H1148V64H1200V120Z';

export interface StreetHouse {
  door: number;
  outline: string;
  roof: string;
  facade: string;
  /** A touch of variety in height, so the street doesn't look stamped out. */
  lift: number;
  state: 'open' | 'waiting' | 'shut';
  opensOn: string;
  /** The prize title (open doors only, or the admin's title for it). */
  title: string;
  /** Who opened it. */
  name: string;
  /** Whether /api/advent/<door> has a picture (open doors only). */
  icon: boolean;
  delay: number;
}

export interface Street {
  title: string;
  intro: string;
  surprise: string;
  year: number;
  openCount: number;
  status: string;
  houses: StreetHouse[];
}

/** The calendar's teaser before its first door (lib/advent.ts adventTeaser). */
export interface AdventTeaser {
  /** The door that opens first, the one the teaser points at. */
  door: number;
  /** Today: the teaser plays once a day on each device. */
  today: string;
  days: number;
  lobby: string;
  lead: string;
  line: string;
  sign: string;
}
