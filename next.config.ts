import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Las guias contienen datos sensibles del alojamiento (codigo de acceso,
        // clave WiFi): fuera de buscadores y sin filtrar el referer a terceros.
        source: "/g/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
