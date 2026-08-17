import { NextResponse } from "next/server";
import { z } from "zod";
import { currentHostId } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { LOCALES, guideSchema, localeSchema } from "@/lib/schema";
import { LOCALE_NAMES } from "@/i18n/dictionaries";

/* ---------------------------------------------------------------------------
   Assisted translation. Two deliberate decisions:

   1. The model translates, it does not write. It never invents content the host
      did not write: the prompt forbids it and the result is validated against
      the same Zod schema the form uses, so a response with extra or missing
      fields is rejected in full.
   2. Translations are stored with reviewed = false and the guide tells the
      guest the text is machine-translated. We do not ask the host to review a
      language they do not speak — that would be an impossible, permanent chore.

   Without GROQ_API_KEY the app works exactly the same; only this button
   switches off.
--------------------------------------------------------------------------- */

const bodySchema = z.object({
  propertyId: z.string(),
  from: localeSchema,
  to: localeSchema,
  /* Regenerate the guide text even if a version already exists. Off by default:
     the usual call is "make sure this language is complete", and re-translating
     text that is already there costs a request and changes nothing. */
  force: z.boolean().default(false),
});

/* Overridable so the whole translation path can be exercised against a local
   stub. Without this the only way to test it is to call a paid provider from a
   machine with internet, which is why this bug survived two rounds of "it
   compiles". */
const ENDPOINT =
  process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1/chat/completions";

/* Every call to the provider goes through here.

   The route used to call fetch bare. When the provider was unreachable, rate
   limited or slow — all three are routine on a free tier — the exception
   escaped, the route answered with an empty 500, and the publish loop ignored
   it. From the host's chair the guide simply stayed in Spanish with no error
   anywhere: the failure was invisible, which is why this took three rounds to
   find. Now every failure has a sentence attached to it. */
/* Models get retired, and this one did — on 16 August 2026, mid-project, and
   the app went quiet because a single hard-coded name had gone 404. So the
   name is now a list: the one you configure, then the current recommended
   model, then its smaller sibling. A decommission costs a slower translation,
   not a broken feature, and the day somebody sets GROQ_MODEL it wins outright. */
const MODELS = [
  process.env.GROQ_MODEL,
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
].filter((name): name is string => Boolean(name));

async function ask(
  system: string,
  user: string,
): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  let last = "No se pudo contactar con el traductor.";
  for (const model of MODELS) {
    const attempt = await askModel(model, system, user);
    if (attempt.ok) return attempt;
    last = attempt.error;
    /* Only a missing model is worth retrying with another name. A rate limit or
       a timeout would fail identically on the next one and would just double
       the wait. */
    if (!attempt.retryWithAnotherModel) return attempt;
  }
  return { ok: false, error: last };
}

async function askModel(
  model: string,
  system: string,
  user: string,
): Promise<
  | { ok: true; content: string }
  | { ok: false; error: string; retryWithAnotherModel?: boolean }
> {
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      /* Four languages in sequence must fit inside the platform's limit. */
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      /* 404 and 400 are how a provider says "that model is gone". */
      const missingModel =
        (response.status === 404 || response.status === 400) && detail.includes("model");
      return {
        ok: false,
        retryWithAnotherModel: missingModel,
        error: missingModel
          ? `El modelo «${model}» ya no está disponible en el proveedor.`
          : response.status === 429
            ? "El traductor está saturado ahora mismo (límite de uso). Inténtalo en un minuto."
            : `El traductor respondió ${response.status}. ${detail.slice(0, 120)}`,
      };
    }

    const raw = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = raw.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: "El traductor devolvió una respuesta vacía." };
    return { ok: true, content };
  } catch (error) {
    const name = (error as Error).name;
    return {
      ok: false,
      error:
        name === "TimeoutError"
          ? "El traductor tardó demasiado en responder."
          : "No se pudo contactar con el traductor.",
    };
  }
}

const placeNotesSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        tagline: z.string().max(80),
        note: z.string().max(400),
      }),
    )
    .max(60),
});

export async function POST(request: Request) {
  const hostId = await currentHostId();
  if (!hostId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "La traducción asistida no está configurada. Añade GROQ_API_KEY al entorno." },
      { status: 501 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  const { propertyId, from, to, force } = parsed.data;
  if (from === to) return NextResponse.json({ error: "Idiomas iguales" }, { status: 400 });

  const repo = getRepo();
  const property = await repo.getProperty(propertyId);
  if (!property || property.hostId !== hostId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const source = await repo.getGuide(propertyId, from);
  if (!source) return NextResponse.json({ error: "No hay guía de origen" }, { status: 404 });

  /* The endpoint completes a language rather than rebuilding it. Before, the
     caller decided by asking "does this guide exist?", which meant that once
     the four versions existed nothing was ever translated again — and the
     host's recommendation notes, which are added later and one at a time, never
     were at all. */
  const existing = await repo.getGuide(propertyId, to);
  const needsGuide = force || !existing;

  let guideResult: "creada" | "ya estaba" = "ya estaba";

  if (needsGuide) {
    const system = [
      "Eres traductor profesional de contenido turístico.",
      `Traduce del ${LOCALE_NAMES[from]} al ${LOCALE_NAMES[to]}.`,
      "Devuelve EXCLUSIVAMENTE un objeto JSON con exactamente las mismas claves y la misma estructura que recibas.",
      "No añadas, no resumas y no inventes información que no esté en el original.",
      "Mantén sin traducir: nombres propios, calles, marcas, redes WiFi y números.",
      "Adapta las horas y los formatos al uso del idioma de destino, sin cambiar el valor.",
    ].join(" ");

    const answer = await ask(system, JSON.stringify(source.content));
    if (!answer.ok) return NextResponse.json({ error: answer.error }, { status: 502 });

    let candidate;
    try {
      candidate = guideSchema.safeParse(JSON.parse(answer.content));
    } catch {
      return NextResponse.json(
        { error: "El traductor devolvió algo que no es JSON válido." },
        { status: 502 },
      );
    }
    if (!candidate.success) {
      return NextResponse.json(
        { error: "La traducción no encaja con la estructura de la guía." },
        { status: 502 },
      );
    }

    await repo.saveGuide(propertyId, to, candidate.data, false);
    guideResult = "creada";
  }

  /* The recommendations travel too.

     Translating the guide but leaving the host's own notes in Spanish was the
     worst of both worlds: a French guest read "Getting around" in French and
     then "pedid el rabo de toro" untranslated — and the note is the whole
     reason a recommendation is worth more than a map pin. Names, addresses and
     dish names stay as they are, which is what a guest needs in order to ask
     for the place out loud. */
  const places = await repo.listPlaces(propertyId);
  const pending = places.filter((place) => {
    const note = place.notes[from];
    return (note?.tagline?.trim() || note?.note?.trim()) && !place.notes[to]?.note?.trim();
  });

  let translatedNotes = 0;
  let noteWarning: string | null = null;

  if (pending.length > 0) {
    const answer = await ask(
      [
        `Traduce del ${LOCALE_NAMES[from]} al ${LOCALE_NAMES[to]}.`,
        'Recibes {"items":[{"id","tagline","note"}]} y devuelves EXACTAMENTE la misma estructura.',
        "No traduzcas nombres propios de locales, calles ni platos típicos: si un plato o un sitio se llama de una forma, esa forma se conserva y, si hace falta, se explica entre paréntesis.",
        "No inventes nada. Mantén el tono de un anfitrión hablando a su huésped.",
      ].join(" "),
      JSON.stringify({
        items: pending.map((place) => ({
          id: place.id,
          tagline: place.notes[from]?.tagline ?? "",
          note: place.notes[from]?.note ?? "",
        })),
      }),
    );

    if (!answer.ok) {
      /* The guide is already translated at this point, so this is a warning
         rather than a failure: the host is told exactly what is missing instead
         of being told nothing, which is what happened before. */
      noteWarning = answer.error;
    } else {
      let parsedPlaces;
      try {
        parsedPlaces = placeNotesSchema.safeParse(JSON.parse(answer.content));
      } catch {
        parsedPlaces = { success: false } as const;
      }
      if (parsedPlaces.success) {
        for (const item of parsedPlaces.data.items) {
          const place = places.find((candidate) => candidate.id === item.id);
          if (!place) continue;
          await repo.savePlace({
            ...place,
            notes: { ...place.notes, [to]: { tagline: item.tagline, note: item.note } },
          });
          translatedNotes += 1;
        }
      } else {
        noteWarning = "El traductor devolvió las notas en un formato inesperado.";
      }
    }
  }

  /* The answer says what actually happened, so "no funcionó" can never again
     mean "something, somewhere, silently". */
  return NextResponse.json({
    ok: true,
    locale: to,
    guide: guideResult,
    notes: translatedNotes,
    pending: pending.length,
    warning: noteWarning,
    locales: LOCALES,
  });
}
