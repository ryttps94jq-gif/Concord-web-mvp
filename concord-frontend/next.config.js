/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    domains: ['localhost', 'concord-os.org'],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  // Security + PWA headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050'} ${process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:5050'} ws: wss:`,
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
      {
        // Allow service worker to control the entire scope
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-cache' },
        ],
      },
    ];
  },
  turbopack: {
    root: __dirname,
  },
  typescript: {
    // Keep strict checks by default; allow CI Docker build to opt out explicitly.
    ignoreBuildErrors: process.env.CI_SKIP_TYPECHECK === '1',
  },
  eslint: {
    // Keep strict checks by default; allow CI Docker build to opt out explicitly.
    ignoreDuringBuilds: process.env.CI_SKIP_LINT_IN_BUILD === '1',
  },
  // WebXR opts for AR lens
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
