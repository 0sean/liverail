import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { get, type Service, type SearchContainer } from "./lib/rtt";
import { format, parse } from "date-fns";

// TODO: Ratelimiting

const departureInputSchema = z.object({
    from: z.string(),
    to: z.string(),
});

export const getDepartures = createServerFn()
    .inputValidator(departureInputSchema)
    .handler(async ({ data }) => {
        const { from, to } = data;
        return await get<SearchContainer>(`/search/${from}/to/${to}`);
    });

const serviceInputSchema = z.object({
    serviceId: z.string(),
    date: z.string(),
});

export const getService = createServerFn()
    .inputValidator(serviceInputSchema)
    .handler(async ({ data }) => {
        const { serviceId, date } = data;
        const formattedDate = format(parse(date, "yyyy-mm-dd", new Date()), "yyyy/mm/dd");
        return await get<Service>(`/service/${serviceId}/${formattedDate}`);
    });
