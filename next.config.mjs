/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Playwright must not be bundled — load it as a native node dependency.
  serverExternalPackages: ["playwright", "playwright-core"],
  // Pin the workspace root — a parent dir also has a lockfile, which otherwise
  // makes Next infer the wrong root.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
