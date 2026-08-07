import type { GuideRecord } from "@/data/seed";
import { LOCALES, type Place, type Property } from "./schema";

/* The completion percentage is not a decorative bar: it is weighted by what
   the guest actually needs. A missing access code costs 18 points; missing FAQs
   cost 4. Every missing point maps to a sentence telling the host what to do. */

export type Check = {
  key: string;
  label: string;
  weight: number;
  done: boolean;
  hint: string;
  step: number;
};

export function completeness(
  property: Property,
  guides: GuideRecord[],
  places: Place[],
): { score: number; checks: Check[]; pending: Check[] } {
  const base = guides.find((g) => g.locale === property.defaultLocale)?.content;
  const checks: Check[] = [
    {
      key: "address",
      label: "Dirección y coordenadas",
      weight: 12,
      done: Boolean(property.address && property.lat && property.lng),
      hint: "Sin coordenadas no hay mapa ni distancias a pie.",
      step: 1,
    },
    {
      key: "access",
      label: "Instrucciones de entrada",
      weight: 18,
      done: Boolean(property.accessCode && (base?.arrivalSteps.length ?? 0) >= 2,),
      hint: "Es lo primero que busca un huésped que acaba de aterrizar.",
      step: 2,
    },
    {
      key: "wifi",
      label: "WiFi",
      weight: 10,
      done: Boolean(property.wifiSsid && property.wifiPassword),
      hint: "Con la red y la clave se genera el QR de conexión automáticamente.",
      step: 2,
    },
    {
      key: "house",
      label: "Cómo funciona la casa",
      weight: 12,
      done: (base?.house.length ?? 0) >= 3,
      hint: "Añade al menos agua caliente, climatización y basuras.",
      step: 3,
    },
    {
      key: "rules",
      label: "Normas",
      weight: 10,
      done: (base?.rules.length ?? 0) >= 3,
      hint: "Marca cada norma como permitida o prohibida: el icono lo pone la app.",
      step: 4,
    },
    {
      key: "places",
      label: "Recomendaciones",
      weight: 14,
      done: places.length >= 5,
      hint: "Cinco sitios con una nota personal valen más que cincuenta de una lista.",
      step: 5,
    },
    {
      key: "transport",
      label: "Cómo moverse",
      weight: 8,
      done: (base?.transport.length ?? 0) >= 2,
      hint: "Incluye cómo llegar desde el aeropuerto o la estación.",
      step: 6,
    },
    {
      key: "emergency",
      label: "Contactos de emergencia",
      weight: 8,
      done: property.contacts.length >= 3,
      hint: "El 112 lo pone la app; añade tu teléfono y una farmacia.",
      step: 6,
    },
    {
      key: "checkout",
      label: "Salida",
      weight: 6,
      done: (base?.checkoutSteps.length ?? 0) >= 2,
      hint: "Dónde dejar las llaves y qué hacer con la basura evita la mitad de los mensajes.",
      step: 7,
    },
    {
      key: "i18n",
      label: "Idiomas disponibles",
      weight: 2,
      /* We never ask the host to "review" the French version: if they do not
         speak it, that is an impossible task and a permanent chore in their
         dashboard. It is enough that the translation exists — the guide tells
         the guest it is machine-translated. */
      done: guides.length === LOCALES.length,
      hint: "Al publicar se generan los cuatro idiomas automáticamente.",
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
