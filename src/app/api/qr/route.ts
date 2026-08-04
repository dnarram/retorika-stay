import { NextResponse } from "next/server";
import QRCode from "qrcode";

/* QR generado en el servidor y devuelto como SVG: pesa menos que un PNG, se
   imprime nítido a cualquier tamaño y no obliga a cargar una librería de QR en
   el navegador del huésped. */
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
