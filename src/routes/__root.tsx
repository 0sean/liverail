import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import appCss from '../styles.css?url'
import type { QueryClient } from '@tanstack/react-query'

const SITE_URL = process.env.SITE_URL || "https://live.transit.fyi";
const SEO_TITLE = "LiveRail";
const SEO_DESCRIPTION = "Track your journey live. No surprises.";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'LiveRail',
      },
      {
        name: 'theme-color',
        content: '#0a0a0a',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: 'LiveRail',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      {
        rel: 'shortcut icon',
        href: '/favicon.ico',
      },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
    ],
    head: () => ({
      meta: [
        { title: SEO_TITLE },
        { name: "description", content: SEO_DESCRIPTION },
        { name: "robots", content: "index, follow" },
        { name: "keywords", content: "live train times, UK train departures, train delay checker, train platform updates, rail tracker" },
        { property: "og:type", content: "website" },
        { property: "og:title", content: SEO_TITLE },
        { property: "og:description", content: SEO_DESCRIPTION },
        { property: "og:url", content: `${SITE_URL}/` },
        { property: "og:site_name", content: "LiveRail" },
        { property: "og:image", content: `${SITE_URL}/logo512.png` },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: SEO_TITLE },
        { name: "twitter:description", content: SEO_DESCRIPTION },
        { name: "twitter:image", content: `${SITE_URL}/logo512.png` },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    }),
  }),

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
