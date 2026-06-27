const path = require('path');
const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'openweathermap.org',
        pathname: '/img/wn/**',
      },
    ],
  },
  env: {
    CESIUM_BASE_URL: '/cesium',
  },

  transpilePackages: ['cesium', 'resium', '@cesium/engine', '@cesium/widgets'],
  webpack: (config, { dev, isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      http: false,
      https: false,
      url: false,
      zlib: false,
    };

    // External / network drives (e.g. /media/...) break webpack HMR and chunk writes.
    if (dev) {
      config.cache = false;
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules/**', '**/.git/**'],
      };
    }

    if (isServer) {
      config.externals = [...(config.externals || []), 'cesium', 'resium'];
      return config;
    }

    config.plugins.push(
      new webpack.DefinePlugin({
        CESIUM_BASE_URL: JSON.stringify('/cesium'),
      }),
    );

    return config;
  },
};

module.exports = nextConfig;
