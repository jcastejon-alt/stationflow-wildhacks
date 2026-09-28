// Retail hours are source-backed. Cafeteria is a user-requested configurable demo policy.
const BASE = 'https://trevecca.sodexomyway.com/en-us/';
const baseLocations = [
  { id: 'cafeteria', name: 'Apple Dining Hall', building: 'Jernigan Student Center', description: 'The cafeteria, with separate omelet and sandwich demo queues.', hoursLabel: 'Mon–Fri 7–9:30 AM, 11 AM–2 PM, 5–8 PM · Sat–Sun 10 AM–2 PM, 5–8 PM', hoursSource: `${BASE}locations/dining-hall`, hoursNote: 'Omelet and sandwich station hours are not verified. This prototype uses published meal blocks and conservatively starts weekend brunch at 10 AM because the Dining Hall and FAQ disagree on Sunday opening. Reduced service between meals is not modeled.' },
  { id: 'hub', name: 'The Hub', building: 'Jernigan Student Center · lower level', description: 'Grill favorites and more, with a sample customizable menu.', hoursLabel: 'Mon–Fri 11 AM–10 PM · Sat–Sun 11 AM–7 PM', hoursSource: `${BASE}locations/the-hub`, hoursNote: 'Published building hours; online pickup cutoffs and sample items are prototype policies, not confirmed campus ordering availability.' },
  { id: 'frothy', name: 'Frothy Monkey', building: 'Waggoner Library', description: 'Sample coffee and espresso drinks inspired by published categories.', hoursLabel: 'Mon–Fri 8 AM–8 PM · Sat 8 AM–4 PM · Sun closed', hoursSource: `${BASE}locations/frothy-monkey`, hoursNote: 'Published location hours. Products, modifiers, availability, and meal-exchange flags are fictional demo examples.' },
  { id: 'starbucks', name: 'We Proudly Serve Starbucks', building: 'Bud Robinson Building', description: 'Sample espresso drinks, brewed coffee, tea, and bakery items.', hoursLabel: 'Mon–Fri 7 AM–4 PM · Sat closed · Sun 8 AM–3 PM', hoursSource: `${BASE}locations/we-proudly-serve-starbucks`, hoursNote: 'Published location hours. This is a small fictional demo menu, not the national or verified campus menu.' },
];
const retailSchedule = {
  hub: { weekday: [[660, 1320]], saturday: [[660, 1140]], sunday: [[660, 1140]] },
  frothy: { weekday: [[480, 1200]], saturday: [[480, 960]], sunday: [] },
  starbucks: { weekday: [[420, 960]], saturday: [], sunday: [[480, 900]] },
};
const chicago = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const parts = (time) => Object.fromEntries(chicago.formatToParts(new Date(time)).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
function localEpoch(year, month, day, minute) {
  const desired = Date.UTC(year, month - 1, day, Math.floor(minute / 60), minute % 60);
  let result = desired;
  for (let i = 0; i < 3; i++) {
    const p = parts(result);
    const represented = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    result += desired - represented;
  }
  return result;
}
const label = (minute) => `${Math.floor(minute / 60) % 12 || 12}:${String(minute % 60).padStart(2, '0')} ${minute < 720 ? 'AM' : 'PM'}`;
export function createServicePolicy({ opensAt = '08:00', closesAt = '20:00' } = {}) {
  const parse = (value) => {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Cafeteria hours must use HH:MM local Central time.');
    return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  };
  const openMinute = parse(opensAt), closeMinute = parse(closesAt);
  if (openMinute > 480 || closeMinute < 670) throw new Error('Demo cafeteria must open by 08:00 and close after the 11:00 grill changeover.');
  const scheduleNote = `Configurable demo policy, not verified campus station hours: cafeteria ${label(openMinute)}–${label(closeMinute)} daily. Omelets 8:00–11:00 AM, then hamburgers on the same physical grill. Sandwiches run continuously while the cafeteria is open.`;
  const locations = baseLocations.map((location) => location.id === 'cafeteria' ? { ...location, description: 'One shared grill for omelets then hamburgers, plus a continuous sandwich station.', hoursLabel: `Daily ${label(openMinute)}–${label(closeMinute)} · Demo operating hours`, hoursNote: scheduleNote } : location);
  const intervalsFor = (stationOrLocation, time) => {
    const station = typeof stationOrLocation === 'string' ? { locationId: stationOrLocation } : stationOrLocation;
    const p = parts(time), intervals = [];
    for (let dayOffset = 0; dayOffset < 9; dayOffset++) {
      const date = new Date(Date.UTC(p.year, p.month - 1, p.day + dayOffset, 12));
      const day = date.getUTCDay();
      const category = day === 0 ? 'sunday' : day === 6 ? 'saturday' : 'weekday';
      const windows = station.locationId === 'cafeteria' ? [[station.id === 'omelet' ? 480 : station.id === 'hamburger' ? 660 : openMinute, station.id === 'omelet' ? 660 : closeMinute]] : retailSchedule[station.locationId]?.[category] || [];
      for (const [start, end] of windows) intervals.push({ start: localEpoch(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), start), end: localEpoch(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), end), today: dayOffset === 0 });
    }
    return intervals;
  };
  const serviceAt = (station, time) => {
    const intervals = intervalsFor(station, time);
    const current = intervals.find((interval) => interval.start <= time && time < interval.end);
    const next = intervals.find((interval) => interval.start > time);
    const today = intervals.find((interval) => interval.today);
    const firstStart = Math.ceil((time + 120000) / 600000) * 600000;
    const canOrderNow = Boolean(current && firstStart + 600000 <= current.end);
    const cafeteria = station.locationId === 'cafeteria';
    const canSchedule = cafeteria ? Boolean(today && (station.id !== 'hamburger' || time >= today.start) && Math.max(firstStart, today.start) + 600000 <= today.end) : canOrderNow;
    const location = locations.find((candidate) => candidate.id === station.locationId);
    const scheduleLabel = cafeteria ? station.id === 'omelet' ? 'Omelets · 8:00–11:00 AM. The same grill switches to hamburgers at 11:00 AM.' : station.id === 'hamburger' ? `Hamburgers · 11:00 AM–${label(closeMinute)}. Ordering opens at 11:00 AM.` : `Sandwiches · ${label(openMinute)}–${label(closeMinute)}, continuous service.` : location.hoursLabel;
    return { open: Boolean(current), acceptingOrders: canOrderNow && !station.paused, canOrderNow, canSchedule, acceptingScheduled: canSchedule && !station.paused, label: !current ? canSchedule ? 'Schedule for today' : 'Closed' : station.paused ? 'Online orders paused' : !canOrderNow ? 'Orders closed for this service' : 'Open for demo orders', closesAt: current ? new Date(current.end).toISOString() : null, nextOpensAt: next ? new Date(next.start).toISOString() : null, scheduledOpensAt: today ? new Date(today.start).toISOString() : null, scheduleEndsAt: today ? new Date(today.end).toISOString() : null, scheduleLabel, scheduleNote: location.hoursNote };
  };
  return { locations, intervalsFor, serviceAt };
}
const defaults = createServicePolicy();
export const locations = defaults.locations;
export const intervalsFor = defaults.intervalsFor;
export const serviceAt = defaults.serviceAt;
