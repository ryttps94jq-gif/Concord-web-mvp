/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    domains: ['localhost', 'concord-os.org'],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  // Security headers (CSP is now set in middleware.ts with per-request nonces)
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
