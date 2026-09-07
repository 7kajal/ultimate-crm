import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["pino", "pino-pretty", "postgres", "@react-pdf/renderer", "razorpay"],
};

export default nextConfig;
