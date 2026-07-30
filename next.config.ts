import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  allowedDevOrigins: ['local-origin.dev', '*.local-origin.dev','*.cloudworkstations.dev'],
  async redirects() {
    // Routes before the dew point app became the homepage
    return [
      { source: '/dew-point', destination: '/', permanent: false },
      { source: '/settings', destination: '/dinnertime/settings', permanent: false },
    ];
  },
  async headers() {
    // Force the HTML documents to revalidate on every load so a device can't
    // keep serving an old shell (and therefore old JS chunks) after a deploy.
    // Hashed assets under /_next/static keep their immutable caching.
    return [
      {
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
