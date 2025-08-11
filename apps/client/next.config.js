/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@confess-and-play/shared'],
  experimental: {
    // For Socket.IO and real-time features
    serverActions: true,
  },
  webpack: (config) => {
    // Handle 3D model files
    config.module.rules.push({
      test: /\.(glb|gltf)$/,
      type: 'asset/resource',
    });
    return config;
  },
};

module.exports = nextConfig;