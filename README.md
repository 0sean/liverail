<img width="1200" height="450" alt="image" src="https://github.com/user-attachments/assets/78366cbc-8956-4161-924b-58370457d9dd" /><br/>

**LiveRail displays data from Realtime Trains with live updates and a minimal UI.**

No need to sit refreshing for your entire journey - everything you need to know is visible at a glance.

### Self-hosting/running locally

LiveRail is designed to run on Cloudflare (though you could likely get it to run anywhere you can run a TanStack Start app with a few minor tweaks).

You can one-click deploy with the button below (though you’ll still need to set the environment variables shown below):

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/0sean/liverail)

Or if you’d like to run locally:

- **Install dependencies:** `pnpm install`
- **Create a `.env` file and populate the following variables:**
    - `RTT_API_KEY`  - get here
    - `SITE_URL` - the site’s base URL, used for SEO tags
    - `VITE_SENTRY_DSN`  - optional, Sentry DSN for error monitoring
- **Run dev server:** `pnpm dev`
- **Deploy to Cloudflare:** `pnpm run deploy`
