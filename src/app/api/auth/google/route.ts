import { NextResponse } from "next/server";
import {
  GOOGLE_STATE_COOKIE,
  authorizationUrl,
  createStateToken,
  googleConfigured,
} from "@/lib/google";

/* Step 1 of the flow: send the host to Google carrying a signed state. */
export async function GET(request: Request) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/?error=google", request.url));
  }

  const { token, nonce } = await createStateToken();
  const response = NextResponse.redirect(authorizationUrl(request, token, nonce));
  response.cookies.set(GOOGLE_STATE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
