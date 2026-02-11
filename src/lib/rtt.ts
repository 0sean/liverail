export async function get<T>(url: string) {
    const auth = Buffer.from(`${process.env.RTT_USERNAME}:${process.env.RTT_PASSWORD}`).toString("base64");
    const r = await fetch(`https://api.rtt.io/api/v1/json${url}`, {
        headers: {
            "Authorization": `Basic ${auth}`,
        },
    });
    if (!r.ok) {
        const text = await r.text();
        throw new Error(`Failed to fetch ${url}: ${text}`);
    }
    return await r.json() as T;
}

export type SearchContainer = {
    location: LocationDetail;
    filter: { destination: LocationDetail } | null;
    services: LocationContainer[];
}

type LocationDetail = {
    name: string;
    crs: string;
    tiploc: string;
    country: string;
    system: string;
}

export type LocationContainer = {
    locationDetail: Location;
    serviceUid: string;
    runDate: string;
    trainIdentity: string;
    runningIdentity: string;
    atocCode: string;
    atocName: string;
    serviceType: "bus" | "ship" | "train";
    isPassenger: boolean;
    plannedCancel: boolean; // Not advertised to be running.
    origin?: Pair[]; // Only with en-route cancellation.
    destination?: Pair[]; // Only with en-route cancellation.
    countdownMinutes?: number; // Only for high frequency metro services (Overground & Merseyrail).
}

type Pair = {
    tiploc: string;
    description: string;
    workingTime: string;
    publicTime: string;
}

type Location = {
    realtimeActivated: boolean;
    tiploc: string;
    crs: string;
    description: string;
    gbttBookedArrival?: string;
    gbttBookedDeparture?: string;
    origin: Pair[];
    destination: Pair[];
    isCall: boolean;
    isCallPublic: boolean;
    realtimeArrival?: string;
    realtimeArrivalActual: boolean;
    realtimeArrivalNoReport: boolean;
    realtimeGbttArrivalLateness: number;
    realtimeDeparture?: string;
    realtimeDepartureActual: boolean;
    realtimeDepartureNoReport: boolean;
    realtimeGbttDepartureLateness: number;
    realtimePass?: string;
    platform: string;
    platformConfirmed: boolean;
    cancelReasonCode?: string;
    cancelReasonShortText?: string;
    cancelReasonLongText?: string;
    displayAs: "CALL" | "PASS" | "ORIGIN" | "DESTINATION" | "STARTS" | "TERMINATES" | "CANCELLED_CALL" | "CANCELLED_PASS";
    serviceLocation?: "APPR_STAT" | "APPR_PLAT" | "AT_PLAT" | "DEP_PREP" | "DEP_READY"
}