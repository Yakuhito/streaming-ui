import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { isServer, dev }) {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')

    // from: https://github.com/vercel/next.js/blob/canary/examples/with-webassembly/next.config.js
    // Use the client static directory in the server bundle and prod mode
    // Fixes `Error occurred prerendering page "/"`
    config.output.webassemblyModuleFilename =
      isServer && !dev
        ? "../static/wasm/[modulehash].wasm"
        : "static/wasm/[modulehash].wasm";

    // Since Webpack 5 doesn't enable WebAssembly by default, we should do it manually
    config.experiments = { ...config.experiments, asyncWebAssembly: true };

    return config
  },
}

export default nextConfig;
