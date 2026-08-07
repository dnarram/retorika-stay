import { NextResponse } from "next/server";
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
  };
  await repo.createHost(host);
  await createSession(host.id);
  return NextResponse.json({ ok: true });
}
