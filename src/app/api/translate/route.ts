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
  return NextResponse.json({ ok: true, locale: to, reviewed: false, locales: LOCALES });
}
