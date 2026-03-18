import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/antfarm', destination: '/antfarm/index.html', permanent: false },
    ];
  },
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
};

export default nextConfig;
