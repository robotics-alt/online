import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_LOCAL_STABLE === '1' ? (process.env.NEXT_LOCAL_DIST || '.next-stable') : '.next',
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return [{
      source: '/TutorSphere-Local-CA.cer',
      headers: [{ key: 'Content-Type', value: 'application/x-x509-ca-cert' }, { key: 'Content-Disposition', value: 'attachment; filename="TutorSphere-Local-CA.cer"' }],
    }]
  },
};

export default nextConfig;
