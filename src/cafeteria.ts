import type { Station, TimingMode } from './types';

export const isCafeteriaStation = (id: string) => ['omelet', 'hamburger', 'sandwich'].includes(id);
export const isGrillStation = (id: string) => id === 'omelet' || id === 'hamburger';

export function physicalStationKey(station: Pick<Station, 'id' | 'physicalStationId' | 'queueGroupId'>) {
  return station.queueGroupId || station.physicalStationId || (isGrillStation(station.id) ? 'cafeteria-grill' : station.id);
}

export function cafeteriaHour(now: string) {
  return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Chicago' }).format(new Date(now)));
}

export function timingAllowed(station: Station, mode: TimingMode) {
  return mode === 'asap'
    ? station.service.canOrderNow ?? station.service.open
    : station.service.canSchedule ?? station.service.open;
}
