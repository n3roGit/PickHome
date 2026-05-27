/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [
    "adm-zip",
    "pdf-parse",
    "@react-pdf/renderer",
    "@react-pdf/layout",
    "@react-pdf/font",
    "@react-pdf/render",
    "@react-pdf/pdfkit",
    "@react-pdf/reconciler",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "200mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self), microphone=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
