import { NextResponse } from "next/server";
import QRCode from "qrcode";

/* QR generated server-side and returned as SVG: smaller than a PNG, sharp at
   any print size, and it keeps a QR library out of the guest's browser. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = searchParams.get("data");
  const size = Number(searchParams.get("size") ?? 320);

  if (!data || data.length > 512) {
    return NextResponse.json({ error: "Parámetro data ausente o demasiado largo" }, { status: 400 });
  }

  /* A QR encoding "/g/abc123" is useless: a phone camera reads it as plain text,
     not as a link. Callers pass a path because a plain <a download> has no way
     to know the origin, so the absolute URL is built here, once, for every call
     site at the same time.

     SECURITY: only two shapes are accepted — a path on this site, or a WIFI:
     payload. Left open, this route was a free QR generator on someone else's
     domain: a phishing link printed on a code that appears to come from
     Retorika. Nothing in the product needs to encode an arbitrary URL. */
  const origin = new URL(request.url).origin;
  let payload: string;
  if (data.startsWith("/")) {
    payload = new URL(data, origin).toString();
  } else if (data.startsWith("WIFI:")) {
    payload = data;
  } else if (data.startsWith(origin)) {
    payload = data;
  } else {
    return NextResponse.json(
      { error: "Solo se admiten rutas de este sitio o credenciales WiFi" },
      { status: 400 },
    );
  }

  const svg = await QRCode.toString(payload, {
    type: "svg",
    margin: 1,
    width: Math.min(Math.max(size, 120), 800),
    color: { dark: "#12517d", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });

  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
