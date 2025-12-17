/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  headers: async () => [
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
      ],
    },
  ],
  images: {
    domains: ['i.ytimg.com', 'img.youtube.com', 'yt3.ggpht.com'],
  },
  webpack: (config) => {
    // Disable webpack's filesystem cache to prevent ENOENT errors when .next/cache is pruned
    config.cache = false
    return config
  },
}

module.exports = nextConfig
