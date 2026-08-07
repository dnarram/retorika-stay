import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { randomBytes } from "node:crypto";
import { createSession, hashPassword } from "@/lib/auth";
import {
  GOOGLE_STATE_COOKIE,
  exchangeCode,
  googleConfigured,
  readStateToken,
} from "@/lib/google";
import { getRepo } from "@/lib/repo";

/* Step 2: Google sends the host back with an authorisation code. */
export async function GET(request: Request) {
  if (!googleConfigured()) return NextResponse.redirect(new URL("/?error=google", request.url));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${GOOGLE_STATE_COOKIE}=`))
    ?.split("=")[1];

  /* The state in the URL and the state in the cookie have to be the same signed
     token. Without this check, an attacker could hand someone a callback URL
     and sign them into an account that is not theirs. */
  if (!code || !returnedState || returnedState !== cookieState) {
    return NextResponse.redirect(new URL("/?error=state", request.url));
  }

  const nonce = await readStateToken(cookieState);
  if (!nonce) return NextResponse.redirect(new URL("/?error=state", request.url));

  const identity = await exchangeCode(request, code, nonce);
  if (!identity) return NextResponse.redirect(new URL("/?error=google", request.url));

  const repo = getRepo();
  let host = await repo.getHostByEmail(identity.email);

  if (!host) {
    /* First sign-in creates the account. The password hash is random and
       unusable on purpose: this account has no password to guess, and the
       column stays NOT NULL without a special case. */
    host = {
      id: `host_${nanoid(10)}`,
      email: identity.email,
      name: identity.name,
      passwordHash: hashPassword(randomBytes(32).toString("hex")),
    };
    await repo.createHost(host);
  }

  await createSession(host.id);
  return NextResponse.redirect(new URL("/panel", request.url));
}
