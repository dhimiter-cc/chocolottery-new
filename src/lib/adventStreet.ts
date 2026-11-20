// The advent calendar drawn as a street of Amsterdam canal houses: everything the
// /advent page and the reveal's calendar moment (AdventMorph.svelte) need, worked
// out on the server so both draw the same street. The 24 doors stand in a shuffled
// order that is the same on every screen for the year.
import { getTheme } from '../themes/index.js';
import { adventEvent, adventView, dayLabel } from './advent.js';
import { getSettings } from './settings.js';
import { seeded } from './bars.js';
import type { Street, StreetHouse } from './adventDoors.js';

export type { Street, StreetHouse };
export { CANAL_PATH } from './adventDoors.js';

// Gables, in a 100 x 160 box: the outline of the house and the roofline the snow lies on.
const GABLES = [
  { // step gable
    outline: 'M0 160V60H10V50H20V40H30V30H40V20H60V30H70V40H80V50H90V60H100V160Z',
    roof: 'M0 60H10V50H20V40H30V30H40V20H60V30H70V40H80V50H90V60H100',
  },
  { // bell gable
    outline: 'M0 160V70Q0 55 15 52Q25 50 25 38Q25 20 50 14Q75 20 75 38Q75 50 85 52Q100 55 100 70V160Z',
    roof: 'M0 70Q0 55 15 52Q25 50 25 38Q25 20 50 14Q75 20 75 38Q75 50 85 52Q100 55 100 70',
  },
  { // neck gable
    outline: 'M0 160V68Q10 66 18 56H28V26Q50 12 72 26V56H82Q90 66 100 68V160Z',
    roof: 'M0 68Q10 66 18 56H28V26Q50 12 72 26V56H82Q90 66 100 68',
  },
  { // spout gable
    outline: 'M0 160V60L50 12L100 60V160Z',
    roof: 'M0 60L50 12L100 60',
  },
];
const FACADES = ['#3B1549', '#4A1F3D', '#2E1A3F', '#5A2E35', '#3A2A4A', '#46233F'];

/** The street, or null when no theme has a calendar. */
export function adventStreet(): Street | null {
  const event = adventEvent();
  if (!event) return null;
  const words = getTheme(event.id).advent!;
  const view = adventView();
  const prizes = getSettings().advent.prizes;
  const openedBy = new Map(view.opened.map((o) => [o.door, o]));
  const waiting = new Set(view.waiting);

  // The 24 doors shuffled, the same way for everyone, once per year.
  const rand = seeded(view.year * 7919);
  const order = view.schedule.map((d) => d.door);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const houses = order.map((door, i): StreetHouse => {
    const r = seeded(view.year * 31 + door * 97);
    const day = view.schedule[door - 1];
    const won = openedBy.get(door);
    const prize = prizes[String(door)];
    const gable = GABLES[Math.floor(r() * GABLES.length)];
    return {
      door,
      outline: gable.outline,
      roof: gable.roof,
      facade: FACADES[Math.floor(r() * FACADES.length)],
      lift: Math.round(r() * 14),
      state: won ? 'open' : waiting.has(door) ? 'waiting' : 'shut',
      opensOn: dayLabel(day.opensOn),
      title: (won?.title || prize?.title || '').trim(),
      name: won?.name ?? '',
      icon: !!(won && prize?.svg),
      delay: (i % 6) * 0.35,
    };
  });

  const openCount = view.opened.length;
  const firstOpens = view.schedule[0].opensOn;
  const status = !view.live || view.today < firstOpens
    ? `The first door opens on ${dayLabel(firstOpens)}.`
    : view.waiting.length
      ? view.waiting.length === 1
        ? `Door ${view.waiting[0]} is waiting: the next win opens it.`
        : `${view.waiting.length} doors are waiting today. The next win opens door ${view.waiting[0]}.`
      : openCount === 24
        ? 'Every door is open. Merry Christmas!'
        : 'Nothing waiting today. Come back tomorrow.';

  return { title: words.title, intro: words.intro, surprise: words.surprise, year: view.year, openCount, status, houses };
}
