import { request, type ApiGeographicLocation, type ApiLocation, type ApiSearch, type ApiService, type ApiTime } from "./rtt-api";

// The UI uses local railway times and a flat view of each calling point. Keep
// the v2 API's nested wire format at this boundary.
export type SearchContainer = {
    location: LocationDetail;
    filter: { destination: LocationDetail } | null;
    services: LocationContainer[] | null;
};

type LocationDetail = { name: string; crs: string; tiploc: string };

export type LocationContainer = {
    locationDetail: Location;
    serviceUid: string;
    runDate: string;
    atocCode: string;
    atocName: string;
};

type Pair = { tiploc: string; description: string; workingTime: string; publicTime: string };

export type Location = {
    tiploc: string;
    crs: string;
    description: string;
    gbttBookedArrival?: string;
    gbttBookedDeparture?: string;
    origin: Pair[];
    destination: Pair[];
    isCall: boolean;
    isPublicCall: boolean;
    realtimeArrival?: string;
    realtimeArrivalActual: boolean;
    realtimeArrivalNoReport: boolean;
    realtimeDeparture?: string;
    realtimeDepartureActual: boolean;
    realtimeDepartureNoReport: boolean;
    platform: string;
    platformConfirmed: boolean;
    cancelReasonCode?: string;
    cancelReasonShortText?: string;
    cancelReasonLongText?: string;
    displayAs: "CALL" | "PASS" | "ORIGIN" | "DESTINATION" | "STARTS" | "TERMINATES" | "CANCELLED_CALL" | "CANCELLED_PASS";
    serviceLocation?: "APPR_STAT" | "APPR_PLAT" | "AT_PLAT" | "DEP_PREP" | "DEP_READY" | "DEPARTING";
};

export type Service = {
    serviceUid: string;
    runDate: string;
    atocCode: string;
    atocName: string;
    origin: Pair[];
    destination: Pair[];
    locations: Location[];
};

const railwayTimeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function railwayTime(value?: string | null): string | undefined {
    if (!value) return undefined;
    // RTT also returns datetimes without an offset, already in railway local time.
    if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return value.slice(11, 16).replace(":", "");
    return railwayTimeFormatter.format(new Date(value)).replace(":", "");
}

function scheduledTime(time?: ApiTime) {
    return railwayTime(time?.scheduleAdvertised ?? time?.scheduleInternal);
}

function realtimeTime(time?: ApiTime) {
    return railwayTime(time?.realtimeActual ?? time?.realtimeForecast ?? time?.realtimeEstimate);
}

function locationDetail(location: ApiGeographicLocation): LocationDetail {
    return {
        name: location.description,
        crs: location.shortCodes?.[0] ?? "",
        tiploc: location.longCodes?.[0]?.replace(/^gb-nr:/, "") ?? "",
    };
}

function pairs(items: ApiService["origin"]): Pair[] {
    return items.map(({ location, temporalData }) => ({
        tiploc: locationDetail(location).tiploc,
        description: location.description,
        workingTime: railwayTime(temporalData.scheduleInternal) ?? "",
        publicTime: scheduledTime(temporalData) ?? "",
    }));
}

const statuses: Record<NonNullable<ApiLocation["temporalData"]["status"]>, Location["serviceLocation"]> = {
    APPROACHING: "APPR_STAT",
    ARRIVING: "APPR_PLAT",
    AT_PLATFORM: "AT_PLAT",
    DEPART_PREPARING: "DEP_PREP",
    DEPART_READY: "DEP_READY",
    DEPARTING: "DEPARTING",
};

function normalizeLocation(item: ApiLocation, origin: Pair[], destination: Pair[], reasons: ApiService["reasons"] = []): Location {
    const detail = locationDetail(item.location);
    const time = item.temporalData;
    const callType = time.realtimeCallType ?? time.scheduledCallType;
    // Retain scheduled calls when they are cancelled or diverted.
    const isCall = Boolean(callType);
    const cancelled = time.displayAs === "CANCELLED" || time.displayAs === "DIVERTED";
    let displayAs: Location["displayAs"];
    if (cancelled) displayAs = isCall ? "CANCELLED_CALL" : "CANCELLED_PASS";
    else if (time.displayAs === "STARTS" || time.displayAs === "TERMINATES") displayAs = time.displayAs;
    else if (!isCall) displayAs = "PASS";
    else if (!time.arrival && time.departure) displayAs = "ORIGIN";
    else if (time.arrival && !time.departure) displayAs = "DESTINATION";
    else displayAs = "CALL";

    const platform = item.locationMetadata?.platform;
    const reason = item.reasons?.find(reason => reason.type === "CANCEL") ?? reasons?.find(reason => reason.type === "CANCEL");
    return {
        crs: detail.crs,
        tiploc: detail.tiploc,
        description: detail.name,
        origin,
        destination,
        isCall,
        isPublicCall: Boolean(callType?.startsWith("ADVERTISED")),
        displayAs,
        gbttBookedArrival: scheduledTime(time.arrival),
        gbttBookedDeparture: scheduledTime(time.departure),
        realtimeArrival: realtimeTime(time.arrival),
        realtimeDeparture: realtimeTime(time.departure),
        realtimeArrivalActual: Boolean(time.arrival?.realtimeActual),
        realtimeDepartureActual: Boolean(time.departure?.realtimeActual),
        realtimeArrivalNoReport: time.arrival?.realtimeNoReport ?? false,
        realtimeDepartureNoReport: time.departure?.realtimeNoReport ?? false,
        platform: platform?.actual ?? platform?.forecast ?? platform?.planned ?? "",
        platformConfirmed: Boolean(platform?.actual),
        serviceLocation: time.status ? statuses[time.status] : undefined,
        cancelReasonCode: reason?.code ?? time.arrival?.cancellationReasonCode ?? time.departure?.cancellationReasonCode,
        cancelReasonShortText: reason?.shortText,
        cancelReasonLongText: reason?.longText ?? reason?.shortText,
    };
}

export async function fetchDepartures(from: string, to: string): Promise<SearchContainer> {
    const data = await request<ApiSearch>("/gb-nr/location", { code: from, filterTo: to, timeWindow: "120" });
    return {
        location: data ? locationDetail(data.query.location) : { name: from, crs: from, tiploc: "" },
        filter: data?.query.filterTo ? { destination: locationDetail(data.query.filterTo) } : null,
        services: data?.services?.length ? data.services.map(item => ({
            serviceUid: item.scheduleMetadata.identity,
            runDate: item.scheduleMetadata.departureDate,
            atocCode: item.scheduleMetadata.operator.code,
            atocName: item.scheduleMetadata.operator.name,
            locationDetail: normalizeLocation({ ...item, location: data.query.location }, pairs(item.origin), pairs(item.destination), item.reasons),
        })) : null,
    };
}

export async function fetchService(serviceId: string, date: string): Promise<Service> {
    const data = await request<{ service: ApiService }>("/gb-nr/service", { identity: serviceId, departureDate: date });
    if (!data) throw new Error("Realtime Trains returned no service");
    const { service } = data;
    const origin = pairs(service.origin);
    const destination = pairs(service.destination);
    return {
        serviceUid: service.scheduleMetadata.identity,
        runDate: service.scheduleMetadata.departureDate,
        atocCode: service.scheduleMetadata.operator.code,
        atocName: service.scheduleMetadata.operator.name,
        origin,
        destination,
        locations: service.locations.map(item => normalizeLocation(item, origin, destination, service.reasons)),
    };
}
