import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchDepartures, fetchService } from "./lib/rtt";

// TODO: Ratelimiting

const departureInputSchema = z.object({
    from: z.string(),
    to: z.string(),
});

export const getDepartures = createServerFn()
    .inputValidator(departureInputSchema)
    .handler(async ({ data }) => {
        const { from, to } = data;
        return await fetchDepartures(from, to);
    });

const serviceInputSchema = z.object({
    serviceId: z.string(),
    date: z.string(),
});

export const getService = createServerFn()
    .inputValidator(serviceInputSchema)
    .handler(async ({ data }) => {
        const { serviceId, date } = data;
        return await fetchService(serviceId, date);
    });
