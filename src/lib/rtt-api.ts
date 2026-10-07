import { env } from "cloudflare:workers";

const API_BASE = "https://data.rtt.io";
const API_VERSION = "2026-07-25";

type AccessToken = { token: string; expiresAt: number };

async function fetchApi(path: string, token: string, cache: boolean) {
    return fetch(`${API_BASE}${path}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            Version: API_VERSION,
        },
        ...(cache ? { cf: { cacheEverything: true, cacheTtl: 10 } } : { cache: "no-store" as const }),
    });
}

function apiError(path: string, response: Response) {
    // Do not expose upstream bodies, which could contain credential information.
    return new Error(`Realtime Trains request failed for ${path}: HTTP ${response.status}`);
}

async function getAccessToken(forceRefresh = false): Promise<string> {
    const key = process.env.RTT_API_KEY;
    if (!key) throw new Error("RTT_API_KEY is not configured");
    const keyHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
    const cacheKey = `access-token:${Array.from(new Uint8Array(keyHash), byte => byte.toString(16).padStart(2, "0")).join("")}`;
    const cache = env.RTT_TOKEN_CACHE;
    if (!forceRefresh) {
        const access = await cache.get<AccessToken>(cacheKey, "json");
        if (access && access.expiresAt > Date.now() + 30_000) return access.token;
    }

    const response = await fetchApi("/api/get_access_token", key, false);
    if (!response.ok) throw apiError("/api/get_access_token", response);
    const data = await response.json() as { token: string; validUntil: string };
    const expiresAt = Date.parse(data.validUntil);
    await cache.put(cacheKey, JSON.stringify({ token: data.token, expiresAt }), {
        expirationTtl: Math.max(60, Math.ceil((expiresAt - Date.now()) / 1000)),
    });
    return data.token;
}

export async function request<T>(path: string, params: Record<string, string>): Promise<T | null> {
    const token = await getAccessToken();
    const url = `${path}?${new URLSearchParams(params)}`;
    let response = await fetchApi(url, token, true);
    if (response.status === 401) {
        // Renew once if the cached access token was invalidated before expiry.
        response = await fetchApi(url, await getAccessToken(true), true);
    }
    if (!response.ok) throw apiError(path, response);
    if (response.status === 204) return null;
    return await response.json() as T;
}

export type ApiGeographicLocation = {
    namespace?: string;
    description: string;
    shortCodes?: string[];
    longCodes?: string[];
};

export type ApiTime = {
    scheduleInternal?: string | null;
    scheduleAdvertised?: string | null;
    realtimeForecast?: string | null;
    realtimeEstimate?: string | null;
    realtimeActual?: string | null;
    realtimeNoReport?: boolean;
    isCancelled?: boolean;
    cancellationReasonCode?: string;
};

type ApiCallType = "OPERATIONAL_ONLY" | "ADVERTISED_OPEN" | "ADVERTISED_SET_DOWN" | "ADVERTISED_PICK_UP";
type ApiReason = { type: "DELAY" | "CANCEL"; code: string; shortText: string; longText?: string | null };

export type ApiLocation = {
    location: ApiGeographicLocation;
    temporalData: {
        arrival?: ApiTime;
        departure?: ApiTime;
        pass?: ApiTime;
        scheduledCallType?: ApiCallType | null;
        realtimeCallType?: ApiCallType | null;
        displayAs?: "CALL" | "CANCELLED" | "DIVERTED" | "STARTS" | "TERMINATES" | "PASS" | null;
        status?: "APPROACHING" | "ARRIVING" | "AT_PLATFORM" | "DEPART_PREPARING" | "DEPART_READY" | "DEPARTING" | null;
    };
    locationMetadata?: { platform?: { planned?: string | null; forecast?: string | null; actual?: string | null } };
    reasons?: ApiReason[];
};

type ApiPair = { location: ApiGeographicLocation; temporalData: ApiTime };
type ApiSchedule = {
    identity: string;
    departureDate: string;
    operator: { code: string; name: string };
};

export type ApiService = {
    scheduleMetadata: ApiSchedule;
    origin: ApiPair[];
    destination: ApiPair[];
    locations: ApiLocation[];
    reasons?: ApiReason[];
};

export type ApiSearch = {
    query: { location: ApiGeographicLocation; filterTo?: ApiGeographicLocation };
    services?: (Omit<ApiLocation, "location"> & Omit<ApiService, "locations">)[] | null;
};
