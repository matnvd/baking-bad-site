import { getCollection, type CollectionEntry } from 'astro:content';

export const TZ = 'America/New_York';
const DEFAULT_LENGTH_MIN = 120;

export type EventEntry = CollectionEntry<'events'>;

export interface EventView {
  id: string;
  title: string;
  kind: EventEntry['data']['kind'];
  partner?: string;
  bake?: string;
  blurb?: string;
  location?: string;
  date: string;
  time?: string;
  /** Start instant. With no time set (TBA), the start of that day in Princeton. */
  startISO: string;
  /** When the event counts as over. With no time set, the end of that day. */
  endISO: string;
  timeKnown: boolean;
  weekday: string; // "Wednesday"
  dateLabel: string; // "Wed, Nov 18"
  longDate: string; // "Wednesday, November 18, 2026"
  month: string; // "Nov"
  day: string; // "18"
  year: number;
  timeLabel: string; // "7 PM" | "Time TBA"
}

/** "-05:00" / "-04:00" for a given Princeton-local date. */
function nyOffset(date: string): string {
  const probe = new Date(`${date}T12:00:00Z`);
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })
    .formatToParts(probe)
    .find((p) => p.type === 'timeZoneName')?.value; // "GMT-05:00"
  return name?.replace('GMT', '') || '-05:00';
}

function addMinutes(iso: string, min: number): string {
  return new Date(new Date(iso).getTime() + min * 60_000).toISOString();
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts });

export function toView(entry: EventEntry): EventView {
  const d = entry.data;
  const off = nyOffset(d.date);
  const timeKnown = Boolean(d.time);
  const startISO = new Date(`${d.date}T${d.time ?? '00:00'}:00${off}`).toISOString();
  let endISO: string;
  if (timeKnown && d.endTime) endISO = new Date(`${d.date}T${d.endTime}:00${off}`).toISOString();
  else if (timeKnown) endISO = addMinutes(startISO, DEFAULT_LENGTH_MIN);
  else endISO = addMinutes(startISO, 24 * 60);

  const noon = new Date(`${d.date}T12:00:00${off}`); // safe instant for date labels
  const start = new Date(startISO);
  const timeLabel = timeKnown
    ? fmt({ hour: 'numeric', minute: start.getUTCMinutes() ? '2-digit' : undefined }).format(start).replace(':00', '')
    : 'Time TBA';

  return {
    id: entry.id,
    title: d.title,
    kind: d.kind,
    partner: d.partner,
    bake: d.bake,
    blurb: d.blurb,
    location: d.location,
    date: d.date,
    time: d.time,
    startISO,
    endISO,
    timeKnown,
    weekday: fmt({ weekday: 'long' }).format(noon),
    dateLabel: fmt({ weekday: 'short', month: 'short', day: 'numeric' }).format(noon),
    longDate: fmt({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(noon),
    month: fmt({ month: 'short' }).format(noon),
    day: fmt({ day: 'numeric' }).format(noon),
    year: Number(d.date.slice(0, 4)),
    timeLabel,
  };
}

export async function getEvents() {
  const all = (await getCollection('events')).map(toView).sort((a, b) => a.startISO.localeCompare(b.startISO));
  const now = Date.now();
  const upcoming = all.filter((e) => new Date(e.endISO).getTime() > now);
  const past = all.filter((e) => new Date(e.endISO).getTime() <= now).reverse(); // newest first
  return { all, upcoming, past };
}

export function monthYear(e: EventView) {
  return `${e.month} ${e.day}, ${e.year}`;
}
