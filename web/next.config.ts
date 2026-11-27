import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // The Docker image builds with NEXT_OUTPUT=standalone: a self-contained server.js.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
