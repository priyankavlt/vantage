import type { NextConfig } from 'next';

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const config: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  typedRoutes: true,
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@vantage/charts', '@vantage/shared'],
  // The browser only ever talks to this origin; Next proxies /api to the server.
  // Same-origin keeps auth cookies simple and avoids CORS in the browser.
  rewrites: () => Promise.resolve([{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }]),
};

export default config;
