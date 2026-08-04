import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { getRepo } from "@/lib/repo";

const bodySchema = z.object({ email: z.string().email(), password: z.string().min(6) });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const host = await getRepo().getHostByEmail(parsed.data.email);
  /* Mismo mensaje y mismo tiempo de respuesta tanto si el correo no existe como
     si la clave falla: no se filtra qué cuentas hay dadas de alta. */
  if (!host || !verifyPassword(parsed.data.password, host.passwordHash)) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos" }, { status: 401 });
  }

  await createSession(host.id);
  return NextResponse.json({ ok: true });
}
