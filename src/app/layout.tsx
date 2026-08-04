import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Retorika Stay",
  description:
    "La guía digital del alojamiento: normas, WiFi, entrada, recomendaciones y emergencias en un solo enlace.",
  applicationName: "Retorika Stay",
  appleWebApp: { capable: true, title: "Retorika Stay", statusBarStyle: "black-translucent" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#12517d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* Fuentes por enlace y no con next/font: la guía se sirve también desde
            el service worker sin conexión, así que la pila de reserva del
            sistema tiene que ser suficiente por sí sola. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
