import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { get, type SearchContainer } from "./lib/rtt";

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