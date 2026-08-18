import { NextResponse } from "next/server";
import { attempt, clientKey } from "@/lib/throttle";
import { nanoid } from "nanoid";
import { z } from "zod";
import { createSession, hashPassword } from "@/lib/auth";
import { getRepo } from "@/lib/repo";

const bodySchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  /* Eight characters minimum, with no symbol requirements: those push people to
     write the password on a sticky note, which is worse than a long password. */
  password: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  /* Five accounts per address per hour: generous for a household sharing a
     connection, useless for a script. */
  const verdict = attempt(clientKey(request, "register"), 5, 60 * 60 * 1000);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: "Demasiadas cuentas creadas desde aquí. Inténtalo más tarde." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisa los datos: la contraseña necesita 8 caracteres." },
      { status: 422 },
    );
  }

  const repo = getRepo();
  const email = parsed.data.email.toLowerCase();
  if (await repo.getHostByEmail(email)) {
    return NextResponse.json({ error: "Ya existe una cuenta con ese correo." }, { status: 409 });
  }

  const host = {
    id: `host_${nanoid(10)}`,
    email,
    name: parsed.data.name,
    passwordHash: hashPassword(parsed.data.password),
    role: "host" as const,
    /* Bucketed at the door and never revisited. It answers "where do hosts come
       from" without keeping a browsing history of anybody, and it is the only
       way to report acquisition channels honestly with no analytics vendor in
       the stack. The interesting bucket is "guia": a guest who read a welcome
       book and came back to make their own. */
    source: acquisitionSource(request.headers.get("referer")),
    createdAt: null,
  };
  await repo.createHost(host);
  await createSession(host.id);
  return NextResponse.json({ ok: true });
}

function acquisitionSource(referer: string | null): string {
  if (!referer) return "directo";
  try {
    const url = new URL(referer);
    if (url.pathname.startsWith("/g/")) return "guia";
    if (url.pathname === "/" || url.pathname.startsWith("/panel")) return "directo";
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "directo";
  }
}
