import { NextResponse } from "next/server";
import { z } from "zod";
import { currentHostId } from "@/lib/auth";

/* ---------------------------------------------------------------------------
   EDITOR assistant. Only here, and for a specific reason.

   In the guest guide a generative model could invent an opening time or an
   address, and the host would be the one held responsible. In the editor there
   is always a person reading the suggestion and deciding: the model reorganises
   what the host already wrote, it does not contribute new facts. The prompt
   forbids that explicitly, and the result comes back as an editable suggestion
   that is never saved on its own.

   Without GROQ_API_KEY the editor works exactly the same; only this button
   switches off.
--------------------------------------------------------------------------- */

const TASKS = {
  pasos:
    "Convierte las notas sueltas del anfitrión en pasos numerados para entrar en el alojamiento. Frases cortas, en segunda persona, en el orden en que ocurren.",
  normas:
    "Convierte las notas del anfitrión en normas de la casa claras y amables. Una norma por línea, sin regañar al huésped.",
  nota:
    "Reescribe la recomendación del anfitrión como una nota personal breve para su huésped: qué pedir o qué hacer allí y un consejo práctico. Máximo dos frases.",
  pulir: "Corrige la ortografía y aclara la redacción sin cambiar el contenido ni el tono.",
} as const;

const bodySchema = z.object({
  task: z.enum(["pasos", "normas", "nota", "pulir"]),
  input: z.string().min(3).max(2000),
});

export async function POST(request: Request) {
  const hostId = await currentHostId();
  if (!hostId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "El asistente no está configurado. Añade GROQ_API_KEY al entorno." },
      { status: 501 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });

  const system = [
    "Ayudas a un anfitrión de alojamiento turístico a redactar la guía de su casa.",
    TASKS[parsed.data.task],
    "REGLA INNEGOCIABLE: no inventes ningún dato que no esté en el texto del anfitrión.",
    "Si falta información, deja un hueco entre corchetes en vez de rellenarlo tú.",
    "Responde solo con el texto resultante, sin introducción ni comentarios.",
  ].join(" ");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      /* Same retired model, same fix. The assistant only ever makes one call,
         so it takes the recommended model directly rather than a fallback
         chain: if it fails the host sees the error and writes the steps
         themselves, which is what they were going to do anyway. */
      model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        { role: "system", content: system },
        { role: "user", content: parsed.data.input },
      ],
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: `El asistente respondió ${response.status}` }, { status: 502 });
  }

  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const suggestion = payload.choices?.[0]?.message?.content?.trim();
  if (!suggestion) return NextResponse.json({ error: "Respuesta vacía" }, { status: 502 });

  /* A suggestion, not a save: the decision stays with the host. */
  return NextResponse.json({ suggestion });
}
