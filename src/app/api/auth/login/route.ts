import { NextResponse } from "next/server";
import { attempt, clear, clientKey } from "@/lib/throttle";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { getRepo } from "@/lib/repo";

const bodySchema = z.object({ email: z.string().email(), password: z.string().min(6) });

export async function POST(request: Request) {
  /* Ten guesses per ten minutes, per address AND per account. Both keys matter:
     one stops somebody working through a dictionary against a single mailbox,
     the other stops them spreading the same password across many. */
  const byIp = clientKey(request, "login");
  const ipVerdict = attempt(byIp, 10, 10 * 60 * 1000);
  if (!ipVerdict.allowed) {
    return NextResponse.json(
      { error: `Demasiados intentos. Prueba de nuevo en ${Math.ceil(ipVerdict.retryInSeconds / 60)} minutos.` },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  /* Two keys, because they stop different attacks: by address stops one machine
     working through a dictionary, by account stops a botnet spreading the same
     dictionary across many addresses against one mailbox. */
  const byAccount = `login-account:${parsed.data.email.toLowerCase()}`;
  const accountVerdict = attempt(byAccount, 10, 10 * 60 * 1000);
  if (!accountVerdict.allowed) {
    return NextResponse.json(
      {
        error: `Demasiados intentos. Prueba de nuevo en ${Math.ceil(
          accountVerdict.retryInSeconds / 60,
        )} minutos.`,
      },
      { status: 429 },
    );
  }

  const host = await getRepo().getHostByEmail(parsed.data.email);
  /* Same message and same response time whether the email does not exist or the
     password is wrong: which accounts exist is not leaked. */
  if (!host || !verifyPassword(parsed.data.password, host.passwordHash)) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos" }, { status: 401 });
  }

  await createSession(host.id);
  /* Proving you own the account clears the count against you. */
  clear(byIp);
  clear(byAccount);
  return NextResponse.json({ ok: true });
}
