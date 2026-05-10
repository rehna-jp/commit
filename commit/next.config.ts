import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ws", "sharp", "tweetnacl"],
  turbopack: {
    resolveAlias: {
      fs: { browser: "./empty-module.js" },
    },
  },
  webpack: (config, { isServer, webpack }) => {
    // Silence WalletConnect → pino → thread-stream test-file warnings.
    // These test helpers aren't needed at runtime and can't be resolved by webpack.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(why-is-node-running|thread-stream\/test\/)$/,
      })
    );

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        os: false,
        path: false,
        crypto: false,
        stream: false,
      };
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
          process: ["process/browser"],
        })
      );
    }
    return config;
  },
};

export default nextConfig;
