import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST(request: Request) {
  await destroySession();
  /* 303 and not the default 307: a 307 preserves the method, so the browser
     would re-issue this POST against "/", which only answers GET. 303 is
     exactly the "your POST is done, now go and GET this" of the HTTP spec.
     Redirecting here instead of returning JSON also means the plain <form> in
     the dashboard needs no JavaScript to log out. */
  return NextResponse.redirect(new URL("/", request.url), 303);
}