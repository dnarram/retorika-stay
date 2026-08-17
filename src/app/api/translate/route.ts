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
});

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

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
  const { propertyId, from, to } = parsed.data;
  if (from === to) return NextResponse.json({ error: "Idiomas iguales" }, { status: 400 });

  const repo = getRepo();
  const property = await repo.getProperty(propertyId);
  if (!property || property.hostId !== hostId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const source = await repo.getGuide(propertyId, from);
  if (!source) return NextResponse.json({ error: "No hay guía de origen" }, { status: 404 });

  const system = [
    "Eres traductor profesional de contenido turístico.",
    `Traduce del ${LOCALE_NAMES[from]} al ${LOCALE_NAMES[to]}.`,
    "Devuelve EXCLUSIVAMENTE un objeto JSON con exactamente las mismas claves y la misma estructura que recibas.",
    "No añadas, no resumas y no inventes información que no esté en el original.",
    "Mantén sin traducir: nombres propios, calles, marcas, redes WiFi y números.",
    "Adapta las horas y los formatos al uso del idioma de destino, sin cambiar el valor.",
    "El tono es el de un anfitrión que habla de tú a su huésped: directo y práctico.",
  ].join(" ");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(source.content) },
      ],
    }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: `El servicio de traducción respondió ${response.status}` },
      { status: 502 },
    );
  }

  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = payload.choices?.[0]?.message?.content;
  if (!raw) return NextResponse.json({ error: "Respuesta vacía" }, { status: 502 });

  const candidate = guideSchema.safeParse(JSON.parse(raw));
  if (!candidate.success) {
    /* If the model strays from the schema nothing is saved: a clear error beats
       a half-translated guide in someone's home. */
    return NextResponse.json(
      { error: "La traducción no respeta la estructura de la guía", detail: candidate.error.flatten() },
      { status: 422 },
    );
  }

  await repo.saveGuide(propertyId, to, candidate.data, false);

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

  if (pending.length > 0) {
    const payloadIn = pending.map((place) => ({
      id: place.id,
      tagline: place.notes[from]?.tagline ?? "",
      note: place.notes[from]?.note ?? "",
    }));

    const placesResponse = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              `Traduce del ${LOCALE_NAMES[from]} al ${LOCALE_NAMES[to]}.`,
              'Recibes {"items":[{"id","tagline","note"}]} y devuelves EXACTAMENTE la misma estructura.',
              "No traduzcas nombres propios de locales, calles ni platos típicos: si un plato o un sitio se llama de una forma, esa forma se conserva y, si hace falta, se explica entre paréntesis.",
              "No inventes nada. Mantén el tono de un anfitrión hablando a su huésped.",
            ].join(" "),
          },
          { role: "user", content: JSON.stringify({ items: payloadIn }) },
        ],
      }),
    });

    if (placesResponse.ok) {
      const raw = (await placesResponse.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const parsedPlaces = placeNotesSchema.safeParse(
        JSON.parse(raw.choices?.[0]?.message?.content ?? "{}"),
      );
      if (parsedPlaces.success) {
        for (const item of parsedPlaces.data.items) {
          const place = places.find((candidatePlace) => candidatePlace.id === item.id);
          if (!place) continue;
          await repo.savePlace({
            ...place,
            notes: { ...place.notes, [to]: { tagline: item.tagline, note: item.note } },
          });
        }
      }
    }
    /* A failure here leaves the guide translated and the notes in the original
       language, which is exactly what happened before and is still readable.
       It is not worth failing the whole publish over. */
  }

  return NextResponse.json({ ok: true, locale: to, reviewed: false, locales: LOCALES });
}
