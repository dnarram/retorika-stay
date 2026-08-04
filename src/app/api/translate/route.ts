import { NextResponse } from "next/server";
import { z } from "zod";
import { currentHostId } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { LOCALES, guideSchema, localeSchema } from "@/lib/schema";
import { LOCALE_NAMES } from "@/i18n/dictionaries";

/* ---------------------------------------------------------------------------
   Traducción asistida. Dos decisiones deliberadas:

   1. La IA traduce, no redacta. Nunca inventa contenido que el anfitrión no
      haya escrito: el prompt lo prohíbe y el resultado se valida contra el
      mismo esquema Zod que el formulario, así que una respuesta con campos de
      más o de menos se rechaza entera.
   2. Lo traducido entra como BORRADOR (reviewed = false). La guía avisa al
      huésped y el panel lo marca en rojo hasta que una persona lo repasa. Una
      traducción automática sin revisar no debe pasar por buena en la casa de
      nadie.

   Sin GROQ_API_KEY la app funciona igual: solo se apaga este botón.
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
    /* Si el modelo se sale del esquema no se guarda nada: mejor un error claro
       que una guía a medio traducir en la casa de un huésped. */
    return NextResponse.json(
      { error: "La traducción no respeta la estructura de la guía", detail: candidate.error.flatten() },
      { status: 422 },
    );
  }

  await repo.saveGuide(propertyId, to, candidate.data, false);
  return NextResponse.json({ ok: true, locale: to, reviewed: false, locales: LOCALES });
}
