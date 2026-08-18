/* ---------------------------------------------------------------------------
   One place to say "that is enough".

   Three endpoints in this app have to stay open to strangers — the PIN gate,
   the login form and the registration form — and each one had, or lacked, its
   own idea of a limit: the PIN gate counted attempts, the metrics endpoint got
   a ceiling later, and login had nothing at all. Thirty guesses against a real
   account went through without a pause, which is all a dictionary attack needs.

   The state is in memory, which is honest about what it is: with several
   instances each holds its own count, so the effective limit is the ceiling
   times the number of instances. That is still the difference between a
   dictionary attack finishing in an hour and finishing in a month, and moving
   it to the database or to Redis is a note in DECISIONES.md rather than a
   pretence here.
--------------------------------------------------------------------------- */

type Entry = { count: number; until: number };

const buckets = new Map<string, Entry>();

export type Verdict = { allowed: boolean; retryInSeconds: number };

export function attempt(key: string, ceiling: number, windowMs: number): Verdict {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.until < now) {
    buckets.set(key, { count: 1, until: now + windowMs });
    /* Bounded so a flood of unique keys cannot grow it without limit. Clearing
       the whole map is crude and correct: the worst case is that a handful of
       honest callers get a fresh allowance. */
    if (buckets.size > 5000) buckets.clear();
    return { allowed: true, retryInSeconds: 0 };
  }

  entry.count += 1;
  if (entry.count > ceiling) {
    return { allowed: false, retryInSeconds: Math.ceil((entry.until - now) / 1000) };
  }
  return { allowed: true, retryInSeconds: 0 };
}

/* A successful login should not leave the failures counting against the person
   who just proved they own the account. */
export function clear(key: string): void {
  buckets.delete(key);
}

export function clientKey(request: Request, scope: string): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return `${scope}:${ip}`;
}
