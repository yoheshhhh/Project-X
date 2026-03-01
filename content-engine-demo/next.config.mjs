/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable image optimizer to reduce DoS surface (GHSA-9g9p-9gw9-jx7f)
  images: { unoptimized: true },
};

export default nextConfig;
