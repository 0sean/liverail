import { createFileRoute, Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useServerFn } from '@tanstack/react-start'
import { getService as getServiceFn } from '@/functions'
import { useQuery } from '@tanstack/react-query';
import { IconArrowRight, IconLoader2 } from '@tabler/icons-react';
import type { Service, Location } from '@/lib/rtt';
import { formatDistanceExact, formatTime } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { compareAsc, compareDesc, intervalToDuration, parse } from 'date-fns';
import clsx from 'clsx';

export const Route = createFileRoute('/$serviceId/$from/$to/$date')({
  component: RouteComponent,
})

const QUERY_REFRESH_INTERVAL_MS = 30000;

function RouteComponent() {
  const { serviceId, to, from, date } = Route.useParams();

  const getService = useServerFn(getServiceFn);
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ["service", serviceId, date],
    queryFn: () => getService({ data: { serviceId, date } }),
    refetchInterval: QUERY_REFRESH_INTERVAL_MS,
    staleTime: QUERY_REFRESH_INTERVAL_MS
  });

  return <div className="h-full w-full flex flex-col justify-center gap-8 p-6">
    {!data ? <IconLoader2 className="animate-spin text-muted-foreground" /> : <>
      <Info
        data={data}
        to={to}
        refreshIntervalMs={QUERY_REFRESH_INTERVAL_MS}
        refreshCycleStartMs={dataUpdatedAt}
      />
      <ServiceState service={data} from={from} to={to} />
    </>}
  </div>
}

function Info({
  data,
  to,
  refreshIntervalMs,
  refreshCycleStartMs
}: {
  data: Service,
  to: string,
  refreshIntervalMs: number,
  refreshCycleStartMs: number
}) {
  const origin = data.locations.find((l) => l.displayAs === "ORIGIN" || l.displayAs === "STARTS") || data.locations[0]!;
  const destination = data.locations.find((l) => l.displayAs === "DESTINATION" || l.displayAs === "TERMINATES") || data.locations[data.locations.length - 1]!;
  const journeyDestination = data.locations.find((l) => l.crs.toLowerCase() === to.toLowerCase())!;

  return <>
    <div className="fixed top-0 left-0 w-full p-6 flex justify-between items-center text-muted-foreground text-xs">
      <p>{formatTime(origin.origin[0].publicTime)} {origin.crs} <IconArrowRight className="inline -mt-0.5" size={12} /> {destination.crs}</p>
      <p>{data.atocName}</p>
    </div>
    <div className="fixed bottom-0 left-0 w-full p-6 flex justify-between items-center text-muted-foreground text-xs">
      <p>Arriving at {formatTime(journeyDestination.realtimeArrival || journeyDestination.gbttBookedArrival || journeyDestination.destination[0].publicTime)}</p>
      <div className="flex items-center gap-2">
        <RefreshProgress intervalMs={refreshIntervalMs} cycleStartMs={refreshCycleStartMs} />
        <Link to="/" className="font-semibold hover:text-primary transition-colors">LiveRail</Link>
      </div>
    </div>
  </>
}

function RefreshProgress({ intervalMs, cycleStartMs }: { intervalMs: number, cycleStartMs: number }) {
  const [nowMs, setNowMs] = useState(() => cycleStartMs);

  useEffect(() => {
    setNowMs(Date.now());
    const tick = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(tick);
  }, [cycleStartMs]);

  const elapsedMs = Math.max(0, nowMs - cycleStartMs);
  const progressValue = Math.min(100, (elapsedMs / intervalMs) * 100);
  const progressDegrees = (progressValue / 100) * 360;

  return <div
    role="progressbar"
    aria-label="Query refresh progress"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(progressValue)}
    className="size-3 shrink-0 rounded-full"
    style={{
      background: `conic-gradient(var(--primary) ${progressDegrees}deg, var(--muted) ${progressDegrees}deg)`
    }}
  />;
}

// Journey state

function getState(service: Service, from: string, to: string) {
  const nextStop = service.locations.find((l) => l.isCall && !l.displayAs.startsWith("CANCELLED_") && !(l.realtimeArrivalActual || l.realtimeArrivalNoReport || l.realtimeDepartureActual || l.realtimeDepartureNoReport));
  const currentStop = service.locations.find((l) => l.isCall && !l.displayAs.startsWith("CANCELLED_") && !(l.realtimeDepartureActual || l.realtimeDepartureNoReport));
  const arrivedStations = service.locations.slice(service.locations.findIndex((l) => l.crs.toLowerCase() === to.toLowerCase())!).map(l => l.crs.toLowerCase());
  const awaitingStations = service.locations.slice(0, service.locations.findIndex((l) => l.crs.toLowerCase() === from.toLowerCase())!).map(l => l.crs.toLowerCase());
  const originStop = service.locations.find((l) => l.displayAs === "ORIGIN" || l.displayAs === "STARTS") || service.locations.filter(l => !l.displayAs.startsWith("CANCELLED_"))[0]!;
  const journeyOrigin = service.locations.find((l) => l.crs.toLowerCase() === from.toLowerCase())!;
  const journeyDestination = service.locations.find((l) => l.crs.toLowerCase() === to.toLowerCase())!;

  if (journeyOrigin.displayAs.startsWith("CANCELLED")) return { state: "CANCELLED" as const };
  if (journeyDestination.displayAs.startsWith("CANCELLED")) return { state: "CANCELLED" as const };
  if (!nextStop) return { state: "ARRIVED" as const };
  if (!currentStop) return { state: "NEXT_STOP" as const, nextStop };
  if (originStop.crs === nextStop.crs) return { state: "AWAITING_START" as const, nextStop };
  if (awaitingStations.includes(currentStop.crs.toLowerCase()) || (currentStop.crs === nextStop.crs && currentStop.crs.toLowerCase() === from.toLowerCase())) return { state: "AWAITING" as const };
  if (nextStop.crs.toLowerCase() === to.toLowerCase()) return { state: "ARRIVING" as const, nextStop };
  if (arrivedStations.includes(currentStop.crs.toLowerCase())) return { state: "ARRIVED" as const };
  if (currentStop?.serviceLocation && !currentStop.serviceLocation.startsWith("APPR")) return { state: "STOPPED" as const, currentStop };
  return { state: "NEXT_STOP" as const, nextStop };
}

function ServiceState({ service, from, to }: { service: Service, from: string, to: string }) {
  const { state, nextStop, currentStop } = getState(service, from, to);

  let content: React.ReactNode;
  switch (state) {
    case "AWAITING_START":
      content = <AwaitingStart stop={nextStop} />; break;
    case "AWAITING":
      content = <Awaiting service={service} from={from} />; break;
    case "NEXT_STOP":
      content = <NextStop stop={nextStop} />; break;
    case "STOPPED":
      content = <Stopped stop={currentStop} />; break;
    case "ARRIVING":
      content = <Arriving stop={nextStop} />; break;
    case "ARRIVED":
      content = <Arrived service={service} to={to} />; break;
    case "CANCELLED":
      content = <Cancelled service={service} />; break;
    default:
      content = <NextStop stop={nextStop} />;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state}
        initial={{ opacity: 0, x: -32 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -32 }}
        transition={{ duration: 0.6, ease: [0.85, 0, 0.15, 1] }}
      >
        {content}
      </motion.div>
      {import.meta.env.DEV && <p className="text-[8px] font-medium text-muted-foreground fixed bottom-3 right-6 opacity-50">{state}</p>}
    </AnimatePresence>
  );
}

// UI utils

function useNow() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const update = () => {
      setNow(new Date());
      const delay = 60000 - (Date.now() % 60000);
      timeout = setTimeout(update, delay);
    };

    const delay = 60000 - (Date.now() % 60000);
    timeout = setTimeout(update, delay);

    return () => clearTimeout(timeout);
  }, []);

  return now;
}

function formatLocation(serviceLocation: Location["serviceLocation"]) {
  switch (serviceLocation) {
    case "APPR_STAT":
      return "Approaching station";
    case "APPR_PLAT":
      return "Approaching platform";
    case "AT_PLAT":
      return "At platform";
    case "DEP_PREP":
      return "Preparing to depart";
    case "DEP_READY":
      return "Ready to depart";
    case "DEPARTING":
      return "Departing";
    default:
      return "";
  }
}

// UI components

function Heading({ children }: { children: React.ReactNode }) {
  return <p className="text-zinc-500 text-xl font-semibold w-full max-w-128 md:max-w-192">{children}</p>;
}

function Highlight({ children, className }: { children: React.ReactNode, className?: string }) {
  return <span className={clsx("text-primary", className)}>{children}</span>;
}

function Subtitle({ children }: { children: React.ReactNode }) {
  return (
    <motion.p
      className="text-zinc-400 dark:text-zinc-600 text-xs absolute -top-4 left-0"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.85, 0, 0.15, 1] }}
    >
      {children}
    </motion.p>
  );
}

function Time({ realtime, booked, backup, now }: { realtime?: string, booked?: string, backup: string, now: Date }) {
  const realtimeParsed = parse(realtime || booked || backup, "HHmm", new Date());
  const bookedParsed = parse(booked || backup, "HHmm", new Date());
  const late = compareAsc(realtimeParsed, bookedParsed);
  const interval = intervalToDuration({ start: bookedParsed, end: realtimeParsed });

  return <Highlight className={clsx(late === 1 && "bg-gradient-to-b bg-clip-text from-red-200 to-red-400 text-transparent")}>
    {formatDistanceExact(realtimeParsed, now)}
    {late === 1 && <span className="text-xs ml-1 align-top">+{interval?.minutes}</span>}
    {late === -1 && <span className="text-green-500 text-xs ml-1 align-top">{interval?.minutes}</span>}
  </Highlight>
}

// State screens

function AwaitingStart({ stop }: { stop: Location }) {
  const now = useNow();
  const departureTime = parse(stop.realtimeDeparture || stop.gbttBookedDeparture || stop.origin[0].publicTime, "HHmm", new Date());
  const timePassed = compareDesc(now, departureTime) !== 1;

  return <div className="relative">
    {stop.serviceLocation && <Subtitle>{formatLocation(stop.serviceLocation)}</Subtitle>}
    <Heading>The train starts {!timePassed ? <>in <Time realtime={stop.realtimeArrival} booked={stop.gbttBookedDeparture} backup={stop.origin[0].publicTime} now={now} /></> : "now"}</Heading>
  </div>;
}

function Awaiting({ service, from }: { service: Service, from: string }) {
  const now = useNow();
  const fromStop = service.locations.find((l) => l.crs.toLowerCase() === from.toLowerCase())!;
  const arrivalTime = parse(fromStop.realtimeArrival || fromStop.gbttBookedArrival || fromStop.destination[0].publicTime, "HHmm", new Date());
  const timePassed = compareDesc(now, arrivalTime) !== 1;

  return <div className="relative">
    {fromStop.serviceLocation && <Subtitle>{formatLocation(fromStop.serviceLocation)}</Subtitle>}
    <Heading>Arriving at <Highlight>{fromStop.description}</Highlight> {!timePassed && <>in <Time realtime={fromStop.realtimeArrival} booked={fromStop.gbttBookedArrival} backup={fromStop.destination[0].publicTime} now={now} /></>}</Heading>
  </div>;
}

function NextStop({ stop }: { stop: Location }) {
  const now = useNow();
  const arrivalTime = parse(stop.displayAs === "ORIGIN" ? (stop.realtimeDeparture || stop.gbttBookedDeparture || stop.origin[0].publicTime) : (stop.realtimeArrival || stop.gbttBookedArrival || stop.destination[0].publicTime), "HHmm", new Date());
  const timePassed = compareDesc(now, arrivalTime) !== 1;

  return <div className="relative">
    {stop.serviceLocation && <Subtitle>{formatLocation(stop.serviceLocation)}</Subtitle>}
    <Heading>The next stop is <Highlight>{stop.description}</Highlight> {!timePassed && <>in <Time realtime={stop.realtimeArrival} booked={stop.gbttBookedArrival} backup={stop.destination[0].publicTime} now={now} /></>}</Heading>
  </div>
}

function Stopped({ stop }: { stop: Location }) {
  const now = useNow();
  const departureTime = parse(stop.realtimeDeparture || stop.gbttBookedDeparture || stop.origin[0].publicTime, "HHmm", new Date());
  const timePassed = compareDesc(now, departureTime) !== 1;

  return <div className="relative">
    {stop.serviceLocation && stop.serviceLocation.startsWith("DEP") && <Subtitle>{formatLocation(stop.serviceLocation)}</Subtitle>}
    <Heading>Stopped in <Highlight>{stop.description}</Highlight>, leaving {timePassed ? "now" : <Time realtime={stop.realtimeDeparture} booked={stop.gbttBookedDeparture} backup={stop.origin[0].publicTime} now={now} />}</Heading>
  </div>
}

function Arriving({ stop }: { stop: Location }) {
  const now = useNow();
  const arrivalTime = parse(stop.realtimeArrival || stop.gbttBookedArrival || stop.destination[0].publicTime, "HHmm", new Date());
  const timePassed = compareDesc(now, arrivalTime) !== 1;

  return <div className="relative">
    {stop.serviceLocation && <Subtitle>{formatLocation(stop.serviceLocation)}</Subtitle>}
    <Heading>Arriving at <Highlight>{stop.description}</Highlight> {!timePassed && <>in <Time realtime={stop.realtimeArrival} booked={stop.gbttBookedArrival} backup={stop.destination[0].publicTime} now={now} /></>}</Heading>
  </div>;
}

function Arrived({ service, to }: { service: Service, to: string }) {
  const toStop = service.locations.find((l) => l.crs.toLowerCase() === to.toLowerCase())!;
  const realtimeArrival = toStop.realtimeArrival ? parse(toStop.realtimeArrival, "HHmm", new Date()) : null;
  const bookedArrival = toStop.gbttBookedArrival ? parse(toStop.gbttBookedArrival, "HHmm", new Date()) : null;
  const late = realtimeArrival && bookedArrival ? compareDesc(realtimeArrival, bookedArrival) : null;

  return <div className="relative">
    {late != null && <Subtitle>Arrived {late === 0 ? "on time" : (late > 0 ? `${formatDistanceExact(realtimeArrival!, bookedArrival!)} late` : `${formatDistanceExact(realtimeArrival!, bookedArrival!)} early`)}</Subtitle>}
    <Heading>Arrived at <Highlight>{toStop.description}</Highlight> 🎉</Heading>
  </div>;
}

function Cancelled({ service }: { service: Service }) {
  const cancelledStops = service.locations.filter((l) => l.displayAs.startsWith("CANCELLED") && l.isPublicCall);

  return <Heading>Your train is cancelled between <Highlight>{cancelledStops[0].description}</Highlight> and <Highlight>{cancelledStops[cancelledStops.length - 1].description}</Highlight> due to <Highlight>{service.locations[0].cancelReasonLongText}</Highlight> ⚠️</Heading>;
}
