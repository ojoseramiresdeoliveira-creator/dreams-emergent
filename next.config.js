const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' },
    ],
  },
  webpack(config, { dev }) {
    if (dev) {
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    // Cross-origin access is opt-in only: without CORS_ORIGINS set, no CORS
    // headers are emitted and the API is same-origin only. Framing stays open
    // for the Emergent preview iframe; revisit before public production.
    const headers = [
      { key: "X-Frame-Options", value: "ALLOWALL" },
      { key: "Content-Security-Policy", value: "frame-ancestors *;" },
    ];
    if (process.env.CORS_ORIGINS) {
      headers.push(
        { key: "Access-Control-Allow-Origin", value: process.env.CORS_ORIGINS },
        { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
        { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
      );
    }
    return [{ source: "/(.*)", headers }];
  },
};

module.exports = nextConfig;
