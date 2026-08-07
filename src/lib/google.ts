import { randomBytes } from "node:crypto";
import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";

/* ---------------------------------------------------------------------------
   Sign in with Google, implemented directly against the OAuth 2.0 / OpenID
   Connect endpoints instead of pulling in an auth framework.

   A note on vocabulary, because the two get conflated constantly: signing in
   with Google is OAuth 2.0 / OIDC — a redirect, an authorisation code and a
   token exchange. The JWT is the format of the session token we issue
   afterwards, which this app already does with `jose`. They are two layers, not
   two alternatives.

   Why by hand: NextAuth would add a dependency, an adapter and a config layer
   to replace roughly a hundred lines that are worth reading. The whole flow is
   here, including the two protections people most often skip — `state` against
   CSRF on the callback and `nonce` binding the ID token to this exact request.

   Without GOOGLE_CLIENT_ID the button is not rendered and nothing here runs:
   email and password remain the primary path, which is also the only way to
   sign in with the demo account.
--------------------------------------------------------------------------- */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/* Google publishes its signing keys and rotates them; createRemoteJWKSet caches
   them and refetches when it meets an unknown key id. */
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export const GOOGLE_STATE_COOKIE = "google_oauth_state";

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET ?? "development-only-secret-at-least-32-chars";
  return new TextEncoder().encode(value);
}

export function redirectUri(request: Request): string {
  /* Built from the incoming request so the same code works on localhost, on a
     Vercel preview deployment and in production without extra configuration.
     Whatever this resolves to must be listed in the Google Cloud console. */
  return new URL("/api/auth/google/callback", request.url).toString();
}

/* The state travels twice: signed inside the URL and signed in an httpOnly
   cookie. On the way back both must match, which is what stops an attacker from
   completing someone else's sign-in. The nonce ends up inside the ID token and
   ties it to this specific request. */
export async function createStateToken(): Promise<{ token: string; nonce: string }> {
  const nonce = randomBytes(16).toString("hex");
  const token = await new SignJWT({ nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret());
  return { token, nonce };
}

export async function readStateToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.nonce === "string" ? payload.nonce : null;
  } catch {
    return null;
  }
}

export function authorizationUrl(request: Request, state: string, nonce: string): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  /* Only asks again for consent when Google decides to; we are not requesting
     offline access because the app never acts on the user's behalf. */
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export type GoogleIdentity = { email: string; name: string };

export async function exchangeCode(
  request: Request,
  code: string,
  expectedNonce: string,
): Promise<GoogleIdentity | null> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(request),
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) return null;

  const { id_token: idToken } = (await response.json()) as { id_token?: string };
  if (!idToken) return null;

  try {
    /* The ID token is verified against Google's public keys — never decoded and
       trusted. Issuer, audience and nonce are all checked. */
    const { payload } = await jwtVerify(idToken, jwks, {
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    if (!ISSUERS.includes(String(payload.iss))) return null;
    if (payload.nonce !== expectedNonce) return null;
    /* An unverified address could belong to someone else: it is not an identity. */
    if (payload.email_verified !== true) return null;

    const email = String(payload.email ?? "").toLowerCase();
    if (!email) return null;
    return { email, name: String(payload.name ?? email.split("@")[0]) };
  } catch {
    return null;
  }
}
