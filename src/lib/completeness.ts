import type { GuideRecord } from "@/data/seed";
import type { Place, Property } from "./schema";

/* The completion percentage is not a decorative bar: it is weighted by what the
   guest actually needs. A missing access code costs 18 points; missing FAQs cost
   4. Every missing point maps to a sentence telling the host what to do.

   Every threshold is ONE item. The earlier version wanted three rules, three
   house notes and three recommendations before it would tick anything, which
   punished a host who had deliberately written a single, well-chosen rule and
   made the checklist feel like it was arguing with them. The nudge towards more
   belongs in the hint, not in a gate — and the guide now shows any section that
   has content, so one rule is a section, not a draft. */

export type Check = {
  key: string;
  label: string;
  weight: number;
  done: boolean;
  hint: string;
  step: number;
  /* Where a check needs several items, the panel shows how many are in and how
     many are expected. "Recomendaciones" staying unticked after adding two of
     them reads as a bug when the target is invisible. */
  progress?: { current: number; target: number };
};

export function completeness(
  property: Property,
  guides: GuideRecord[],
  places: Place[],
): { score: number; checks: Check[]; pending: Check[] } {
  /* Two conditions, not one: the section has content, and the host has opened
     the step it lives in. Pre-filled starter content the host never saw is not
     a finished section, it is a suggestion nobody has read. */
  const seen = (step: number) => property.visitedSteps.includes(step);
  const base = guides.find((g) => g.locale === property.defaultLocale)?.content;
  const checks: Check[] = [
    {
      key: "address",
      label: "Dirección y coordenadas",
      weight: 12,
      done: (Boolean(property.address && property.lat && property.lng)) && seen(1),
      hint: "Sin coordenadas no hay mapa ni distancias a pie.",
      step: 1,
    },
    {
      key: "access",
      label: "Instrucciones de entrada",
      weight: 18,
      done: (Boolean(property.accessCode) || (base?.arrivalSteps.length ?? 0) > 0) && seen(2),
      hint: "Es lo primero que busca un huésped que acaba de aterrizar.",
      step: 2,
    },
    {
      key: "wifi",
      label: "WiFi",
      weight: 10,
      done: (Boolean(property.wifiSsid || property.wifiPassword)) && seen(2),
      hint: "Con la red y la clave se genera el QR de conexión automáticamente.",
      step: 2,
    },
    {
      key: "house",
      label: "Cómo funciona la casa",
      weight: 12,
      done: ((base?.house.length ?? 0) > 0) && seen(3),
      hint: "Agua caliente, climatización y basuras son las tres que más se preguntan.",
      step: 3,
    },
    {
      key: "rules",
      label: "Normas",
      weight: 10,
      done: ((base?.rules.length ?? 0) > 0) && seen(4),
      hint: "Marca cada norma como permitida o prohibida: el icono lo pone la app.",
      step: 4,
    },
    {
      key: "places",
      label: "Recomendaciones",
      weight: 14,
      done: (places.length > 0) && seen(5),
      hint: "Con uno basta para que aparezca. Tres o cuatro con nota personal hacen la guía.",
      step: 5,
    },
    {
      key: "transport",
      label: "Cómo moverse",
      weight: 8,
      done: ((base?.transport.length ?? 0) > 0) && seen(6),
      hint: "Incluye cómo llegar desde el aeropuerto o la estación.",
      step: 6,
    },
    {
      key: "emergency",
      label: "Contactos de emergencia",
      weight: 8,
      done: (property.contacts.length > 0) && seen(6),
      hint: "El 112 lo pone la app; añade tu teléfono y una farmacia.",
      step: 6,
    },
    {
      key: "faq",
      label: "Preguntas frecuentes",
      weight: 4,
      done: ((base?.faqs.length ?? 0) > 0) && seen(7),
      hint: "Escribe la pregunta que ya te han hecho tres veces por WhatsApp.",
      step: 7,
    },
    {
      key: "checkout",
      label: "Salida",
      weight: 6,
      done: ((base?.checkoutSteps.length ?? 0) > 0) && seen(7),
      hint: "Dónde dejar las llaves y qué hacer con la basura evita la mitad de los mensajes.",
      step: 7,
    },
  ];

  const total = checks.reduce((sum, c) => sum + c.weight, 0);
  const earned = checks.reduce((sum, c) => sum + (c.done ? c.weight : 0), 0);

  return {
    score: Math.round((earned / total) * 100),
    checks,
    pending: checks.filter((c) => !c.done).sort((a, b) => b.weight - a.weight),
  };
}
