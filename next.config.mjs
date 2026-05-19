/** @type {import('next').NextConfig} */
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["adm-zip"],
    serverActions: {
      bodySizeLimit: "200mb",
    },
  },
};

export default nextConfig;
