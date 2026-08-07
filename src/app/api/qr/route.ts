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

  const svg = await QRCode.toString(data, {
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
