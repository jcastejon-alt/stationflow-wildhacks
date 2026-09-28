import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, Beef, Coffee, EggFried, MapPin, Sandwich, Store, Utensils, Clock3, Users } from 'lucide-react';
import type { Catalog, DiningLocation, Station } from './types';
import { time, usePoll } from './api';
import { ErrorBox, Loading } from './App';
import { cafeteriaHour, isGrillStation, physicalStationKey } from './cafeteria';
import './places-visual.css';

const icons = { cafeteria: Utensils, hub: Store, frothy: Coffee, starbucks: Coffee, omelet: EggFried, hamburger: Beef, sandwich: Sandwich };
const placeNames: Record<string, string> = { cafeteria: 'Cafeteria', hub: 'The Hub', frothy: 'Frothy', starbucks: 'Starbucks' };
const placeDescriptions: Record<string, string> = {
  cafeteria: 'Your grill favorites & sandwiches, made your way.',
  hub: 'Your favorite bites between classes.',
  frothy: 'A coffee break worth making time for.',
  starbucks: 'A familiar stop for your daily cup.',
};
const placeCategories: Record<string, string> = {
  cafeteria: 'Made your way',
  hub: 'Campus favorites',
  frothy: 'Coffee & company',
  starbucks: 'Your daily pause',
};

function serviceStatus(stations: Station[]) {
  if (stations.some(station => station.service?.acceptingOrders)) return 'Taking orders';
  if (stations.some(station => station.service?.acceptingScheduled)) return 'Scheduling available';
  if (stations.some(station => station.paused && (station.service?.open || station.service?.canSchedule))) return 'Orders paused';
  if (stations.some(station => station.service?.open)) {
    return stations.find(station => station.service?.open)?.service.label || 'Ordering closed';
  }
  return 'Closed for now';
}

function closingSummary(stations: Station[]) {
  const closesAt = stations.filter(station => station.service?.acceptingOrders).map(station => station.service.closesAt).filter((value): value is string => Boolean(value)).sort().at(-1);
  if (closesAt) return `Until ${time(closesAt)}`;
  if (stations.some(station => station.service?.acceptingScheduled)) return 'Pickup later today';
  const next = stations.map(station => station.service?.nextOpensAt).filter((value): value is string => Boolean(value)).sort()[0];
  return next ? `Next service ${new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(new Date(next))}` : 'See service hours';
}

export function ClockNotice({ catalog }: { catalog: Catalog }) {
  if (!catalog.serviceClock || catalog.serviceClock.mode === 'live') return null;
  const label = new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/Chicago', timeZoneName: 'short',
  }).format(new Date(catalog.serviceClock.now));
  return <div className="clock-notice compact-clock"><Clock3 size={16} /><span><strong>Demo time</strong> · {label}</span></div>;
}

function PlaceCard({ location, stations, index }: { location: DiningLocation; stations: Station[]; index: number }) {
  const Icon = icons[location.id as keyof typeof icons] || Utensils;
  const accepting = stations.some(station => station.service?.acceptingOrders);
  const scheduling = !accepting && stations.some(station => station.service?.acceptingScheduled);
  const groups = new Map<string, number>();
  for (const station of stations) groups.set(physicalStationKey(station), Math.max(groups.get(physicalStationKey(station)) || 0, station.queue?.active || 0));
  const active = [...groups.values()].reduce((sum, count) => sum + count, 0);
  const target = location.id === 'cafeteria' ? '/locations/cafeteria' : `/order/${location.id}`;
  return (
    <Link to={target} className={`place-v4-card place-v4-${location.id}`}>
      <div className="place-v4-art" aria-hidden="true">
        <div className="place-v4-art-caption">
          <span className="place-v4-number">{String(index + 1).padStart(2, '0')}</span>
          <span>{placeCategories[location.id] || 'On campus'}</span>
        </div>
        <span className="place-v4-orbit" />
        <span className="place-v4-symbol"><Icon size={64} strokeWidth={1.2} /></span>
        <span className="place-v4-art-detail" />
      </div>
      <div className="place-v4-body">
        <span className={`place-v4-state ${accepting || scheduling ? 'is-open' : 'is-closed'}`}>
          <span className="place-v4-status-dot" />{serviceStatus(stations)}
        </span>
        <h2>{placeNames[location.id] || location.name}</h2>
        <p>{placeDescriptions[location.id] || location.description}</p>
        <div className="place-v4-details">
          <span className="place-v4-building"><MapPin size={14} />{location.building}</span>
          <span className="place-v4-hours"><Clock3 size={14} />{closingSummary(stations)}</span>
          <span className="place-v4-queue"><Users size={14} />{active} orders in progress</span>
        </div>
        <span className="place-v4-action">
          {location.id === 'cafeteria' ? accepting ? 'Choose a station' : scheduling ? 'Schedule at a station' : 'View stations' : scheduling ? 'Schedule pickup' : accepting ? 'Explore menu' : 'Browse menu'}
          <span><ArrowUpRight size={18} /></span>
        </span>
      </div>
    </Link>
  );
}

export function PlaceCards({ catalog }: { catalog: Catalog }) {
  return (
    <div className="campus-places-grid places-visual-grid">
      {catalog.locations.map((location, index) => (
        <PlaceCard
          key={location.id}
          location={location}
          index={index}
          stations={catalog.stations.filter(station => station.locationId === location.id)}
        />
      ))}
    </div>
  );
}

export function StationCards({ stations, now }: { stations: Station[]; now: string }) {
  const grillMenuId = cafeteriaHour(now) < 11 ? 'omelet' : 'hamburger';
  const grill = stations.find(station => station.id === grillMenuId) || stations.find(station => isGrillStation(station.id));
  const physicalStations = [...(grill ? [grill] : []), ...stations.filter(station => !isGrillStation(station.id))];
  const burger = stations.find(station => station.id === 'hamburger');
  const grillClosesAt = burger?.service.scheduleEndsAt;
  return (
    <div className="cafeteria-stations-grid stations-visual-grid">
      {physicalStations.map((station, index) => {
        const Icon = icons[station.id as keyof typeof icons] || Utensils;
        const isGrill = isGrillStation(station.id);
        const accepting = station.service?.acceptingOrders;
        const scheduling = !accepting && station.service?.acceptingScheduled;
        return (
          <Link to={`/order/${station.id}`} key={station.id} className={`station-v4-card station-v4-${station.id}`}>
            <div className="station-v4-art" aria-hidden="true">
              <span className="station-v4-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="station-v4-symbol"><Icon size={76} strokeWidth={1.1} /></span>
              <span className="station-v4-art-label">{station.id === 'omelet' ? 'Crack into a favorite.' : station.id === 'hamburger' ? 'Your next grill favorite.' : 'Stacked just for you.'}</span>
            </div>
            <div className="station-v4-body">
              <span className={`place-v4-state ${accepting || scheduling ? 'is-open' : 'is-closed'}`}>
                <span className="place-v4-status-dot" />{serviceStatus([station])}
              </span>
              <span className="station-physical-label">{isGrill ? 'THE GRILL · ONE SHARED STATION' : 'THE SANDWICH STATION'}</span>
              <h2>{station.name}</h2>
              <p>{station.description}</p>
              <div className="station-menu-schedule">
                {isGrill ? <>
                  <span className={station.id === 'omelet' ? 'current-menu' : ''}><strong>Omelets</strong><span>8–11 AM</span></span>
                  <span className={station.id === 'hamburger' ? 'current-menu' : ''}><strong>Hamburgers</strong><span>11 AM–{grillClosesAt ? time(grillClosesAt) : 'closing'}</span></span>
                </> : <span className="current-menu"><strong>Sandwiches</strong><span>{station.service.scheduledOpensAt ? time(station.service.scheduledOpensAt) : '8 AM'}–{station.service.scheduleEndsAt ? time(station.service.scheduleEndsAt) : 'closing'}</span></span>}
              </div>
              <div className="station-v4-details">
                <span><Clock3 size={14} />{closingSummary([station])}</span>
                <span><Users size={14} />{station.queue?.active || 0} orders in progress</span>
              </div>
              <span className="place-v4-action">{accepting ? 'Make it yours' : scheduling ? 'Schedule pickup' : 'Browse menu'} <span><ArrowRight size={18} /></span></span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function LocationPage() {
  const { locationId } = useParams();
  const { data, error, loading, refresh } = usePoll<Catalog>('/catalog');
  if (loading) return <Loading />;
  const location = data?.locations.find(place => place.id === locationId);
  if (!location || !data) {
    return <section className="page-intro"><ErrorBox message={error || 'We couldn’t find that campus location.'} retry={() => void refresh()} /></section>;
  }
  if (location.id !== 'cafeteria') return <Navigate to={`/order/${location.id}`} replace />;
  const stations = data.stations.filter(station => station.locationId === location.id);

  return (
    <section className="cafeteria-location cafeteria-visual">
      <Link className="back-link" to="/"><ArrowLeft size={15} /> All places</Link>
      <div className="campus-welcome">
        <div><span className="eyebrow">APPLE DINING HALL</span><h1>{stations.some(station => station.service.acceptingOrders || station.service.acceptingScheduled) ? 'Make it your kind of meal.' : 'Explore the dining hall menus.'}</h1><p>Two stations. The grill changes menus at 11 AM.</p></div>
        <span className="campus-context"><Utensils size={15} /> Cafeteria</span>
      </div>
      <ClockNotice catalog={data} />
      {error && <ErrorBox message={error} />}
      <div className="cafeteria-entry-banner"><Utensils size={18} /><span><strong>Included after dining hall entry.</strong> No extra payment at these stations.</span></div>
      <StationCards stations={stations} now={data.serviceClock.now} />
      <details className="location-hours-details">
        <summary><Clock3 size={16} /> Dining hall hours & information</summary>
        <p>{location.hoursLabel}</p>
        <p>{location.hoursNote}</p>
        <p>{stations[0]?.service?.scheduleNote}</p>
        {location.hoursSource && <a href={location.hoursSource} target="_blank" rel="noreferrer" className="text-button">Published dining information <ArrowUpRight size={13} /></a>}
      </details>
    </section>
  );
}

export function ServiceDetails({ station }: { station: Station }) {
  const service = station.service;
  if (!service) return null;
  return (
    <div className={`service-details ${service.acceptingOrders ? '' : 'service-unavailable'}`}>
      <span className="service-details-status"><span className="dot" />{service.label}</span>
      <span>{service.open && service.closesAt ? `Closes at ${time(service.closesAt)}` : service.nextOpensAt ? `Next opening: ${new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(new Date(service.nextOpensAt))}` : 'No pickup windows right now'}</span>
      <span><Users size={12} />{station.queue?.active || 0} orders in progress</span>
    </div>
  );
}
