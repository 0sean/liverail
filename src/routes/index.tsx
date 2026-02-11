import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { IconArrowRight, IconArrowsLeftRight, IconCheck, IconDirections, IconMapPin, IconTrain } from "@tabler/icons-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import Stations, { type StationData } from "uk-railway-stations";
import { InputGroupAddon } from "@/components/ui/input-group";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { useServerFn } from "@tanstack/react-start";
import { getDepartures as getDeparturesFn } from "@/functions";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { LocationContainer } from "@/lib/rtt";
import { Badge } from "@/components/ui/badge";
import { compareDesc, formatDistance, isEqual, parse } from "date-fns";

export const Route = createFileRoute("/")({ component: App });

const STATION_ITEM_HEIGHT = 32;
const STATION_LIST_OVERSCAN = 8;

function App() {
  const [from, setFrom] = useState<StationData | null>(null);
  const [to, setTo] = useState<StationData | null>(null);

  return <div className="h-full w-full flex flex-col justify-center items-center gap-8 p-6">
    <div className="flex gap-4 absolute top-0 left-0 w-full justify-center items-center p-6">
      <h2 className="text-lg font-semibold">LiveRail</h2>
      <p className="opacity-30 text-sm">Live train times</p>
    </div>
    <div className="flex flex-col gap-2 items-center">
      <h1 className="text-2xl font-semibold dark:text-shadow-lg">Where are you headed?</h1>
      <p className="text-sm text-muted-foreground">Track your journey live. No refreshing. No surprises.</p>
    </div>
    <Card className="w-full md:w-fit">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-2 relative">
          <StationCombobox
            placeholder="From"
            value={from}
            onValueChange={setFrom}
            icon={<IconMapPin />}
          />
          <Button className="hidden md:flex" variant="ghost" size="icon" onClick={() => {
            setFrom(to);
            setTo(from);
          }}>
            <IconArrowsLeftRight />
          </Button>
          <StationCombobox
            placeholder="To"
            value={to}
            onValueChange={setTo}
            icon={<IconDirections />}
          />
        </div>
        <div className="flex justify-between md:items-end items-center gap-2">
          <p className="text-[10px] md:text-xs text-muted-foreground">Works across all train operators in the UK.</p>
          <Button className="md:hidden ml-auto opacity-50 hover:opacity-100 transition-opacity" variant="ghost" size="icon" onClick={() => {
            setFrom(to);
            setTo(from);
          }}>
            <IconArrowsLeftRight />
          </Button>
          <TimetableBrowser from={from} to={to}>
            <Button className="self-end" disabled={!from || !to}>
              <IconTrain />
              Find my train
            </Button>
          </TimetableBrowser>
        </div>
      </CardContent>
    </Card>
    <div className="flex absolute bottom-0 left-0 w-full justify-center items-center p-6">
      <p className="text-xs text-muted-foreground hover:text-foreground transition-colors">A <a href="https://transit.fyi" target="_blank" rel="noopener noreferrer">Transit.fyi</a> project. Powered by <a href="https://realtimetrains.co.uk/" target="_blank" rel="noopener noreferrer">Realtime Trains</a></p>
    </div>
  </div>;
}

function StationCombobox({
  value,
  onValueChange,
  placeholder,
  icon,
}: {
  value: StationData | null;
  onValueChange: (value: StationData | null) => void;
  placeholder: string;
  icon: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const filteredStations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return Stations;
    }

    return Stations.filter((station) => {
      const normalizedName = station.stationName.toLowerCase();
      const normalizedCode = station.crsCode.toLowerCase();

      return normalizedName.includes(normalizedQuery) || normalizedCode.includes(normalizedQuery);
    });
  }, [query]);

  const rowVirtualizer = useVirtualizer({
    count: filteredStations.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => STATION_ITEM_HEIGHT,
    overscan: STATION_LIST_OVERSCAN,
    enabled: open,
    initialRect: { width: 0, height: 288 },
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    rowVirtualizer.measure();
  }, [open, rowVirtualizer, filteredStations.length]);

  const handleItemHighlighted = useCallback((
    highlightedValue: StationData | undefined,
    eventDetails: { reason: "keyboard" | "pointer" | "none" },
  ) => {
    if (!highlightedValue) {
      return;
    }
    if (eventDetails.reason !== "keyboard") {
      return;
    }

    const highlightedIndex = filteredStations.findIndex((station) => station.crsCode === highlightedValue.crsCode);
    if (highlightedIndex >= 0) {
      rowVirtualizer.scrollToIndex(highlightedIndex, { align: "auto" });
    }
  }, [filteredStations, rowVirtualizer]);

  return <Combobox
    items={filteredStations}
    virtualized
    itemToStringLabel={(station: StationData) => station.stationName}
    itemToStringValue={(station: StationData) => station.crsCode}
    value={value}
    onValueChange={onValueChange}
    onInputValueChange={setQuery}
    onItemHighlighted={handleItemHighlighted}
    onOpenChange={setOpen}
  >
    <ComboboxInput placeholder={placeholder}>
      <InputGroupAddon>
        {icon}
      </InputGroupAddon>
    </ComboboxInput>
    <ComboboxContent>
      <ComboboxEmpty>No stations found.</ComboboxEmpty>
      <ComboboxList ref={listRef}>
        <div
          className="relative w-full"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const station = filteredStations[virtualItem.index];
            if (!station) {
              return null;
            }

            return (
              <div
                key={`${station.crsCode}-${virtualItem.index}`}
                className="absolute top-0 left-0 w-full"
                style={{
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <ComboboxItem
                  index={virtualItem.index}
                  value={station}
                  className="h-8 text-sm"
                >
                  {station.stationName}
                </ComboboxItem>
              </div>
            );
          })}
        </div>
      </ComboboxList>
    </ComboboxContent>
  </Combobox>;
}

function TimetableBrowser({ from, to, children }: { from: StationData | null, to: StationData | null, children: ReactNode }) {
  return <Drawer>
    <DrawerTrigger>
      {children}
    </DrawerTrigger>
    <DrawerContent className="max-w-xl mx-auto">
      {from && to && <Timetable from={from} to={to} />}
    </DrawerContent>
  </Drawer>
}

function Timetable({ from, to }: { from: StationData, to: StationData }) {
  // TODO: Show errors
  const getDepartures = useServerFn(getDeparturesFn);
  const { data } = useQuery({ queryKey: ["departures", from.crsCode, to.crsCode], queryFn: () => getDepartures({ data: { from: from.crsCode, to: to.crsCode } }), refetchInterval: 60000 });

  return <>
    <DrawerHeader>
      <DrawerTitle className="text-lg font-semibold">{from.stationName} to {to.stationName}</DrawerTitle>
      <DrawerDescription>Live departures</DrawerDescription>
    </DrawerHeader>
    <div className="p-6 pt-2">
      {!data ? <Skeleton className="h-full h-32" /> : <Card className="p-0 gap-0">
        <Table>
          <TableBody>
            {!data.services ? <TableRow><TableCell className="p-8 text-muted-foreground text-center">No services found in the next 2 hours.</TableCell></TableRow> : data.services.map((service) => <ServiceRow key={service.serviceUid} service={service} from={from} to={to} />)}
          </TableBody>
        </Table>
      </Card>}
    </div>
  </>
}

function formatTime(date: string) {
  return `${date.slice(0, 2)}:${date.slice(2, 4)}`;
}

function ServiceRow({ service }: { service: LocationContainer }) {
  const navigate = useNavigate();
  const realtimeDeparture = service.locationDetail.realtimeDeparture ? parse(service.locationDetail.realtimeDeparture, "HHmm", new Date()) : null;
  const bookedDeparture = service.locationDetail.gbttBookedDeparture ? parse(service.locationDetail.gbttBookedDeparture, "HHmm", new Date()) : null;

  // TODO: Realtime activated

  return <TableRow className="cursor-pointer" onClick={() => navigate({
    to: "/"
  })}>
    <TableCell className="text-lg font-semibold w-4">{service.locationDetail.gbttBookedDeparture ? formatTime(service.locationDetail.gbttBookedDeparture) : `--:--`}</TableCell>
    <TableCell className="w-2"><IconArrowRight size={14} /></TableCell>
    <TableCell>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{service.locationDetail.destination[service.locationDetail.destination.length - 1].description}</p>
          {realtimeDeparture && bookedDeparture && <Badge className="text-[10px] p-1.5 h-4" variant="secondary">{isEqual(realtimeDeparture, bookedDeparture) ? "On time" : formatDistance(realtimeDeparture, bookedDeparture) + " " + (compareDesc(realtimeDeparture, bookedDeparture) === -1 ? "late" : "early")}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{service.atocName} | Arrives at {service.locationDetail.realtimeArrival ? <>{service.locationDetail.gbttBookedArrival && service.locationDetail.gbttBookedArrival !== service.locationDetail.realtimeArrival && <span className="line-through">{formatTime(service.locationDetail.gbttBookedArrival)}</span>} {formatTime(service.locationDetail.realtimeArrival)}</> : (service.locationDetail.gbttBookedArrival ? formatTime(service.locationDetail.gbttBookedArrival) : `--:--`)}</p>
      </div>
    </TableCell>
    <TableCell>
      <Badge variant="secondary" className="float-end">
        <span className="hidden md:inline">Platform </span>{service.locationDetail.platform || "?"} {service.locationDetail.platformConfirmed && <IconCheck />}
      </Badge>
    </TableCell>
  </TableRow>
}
