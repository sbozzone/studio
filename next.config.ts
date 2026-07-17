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
};

export default nextConfig;
