import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { currentHostId } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import type { Guide, Property } from "@/lib/schema";

const bodySchema = z.object({
  name: z.string().min(2).max(80),
  city: z.string().min(2).max(80),
  address: z.string().min(4).max(160),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/* Guía en blanco pero no vacía: el anfitrión empieza con la estructura puesta y
   solo tiene que rellenar. Una plantilla ahorra más fricción que cualquier
   importación automática. */
const BLANK: Guide = {
  welcomeTitle: "",
  welcomeIntro: "",
  arrivalSteps: [""],
  parking: "",
  wifiNote: "",
  house: [
    { title: "Agua caliente", body: "" },
    { title: "Climatización", body: "" },
    { title: "Basura y reciclaje", body: "" },
  ],
  rules: [
    { text: "Silencio de 23:00 a 8:00.", allowed: null },
    { text: "No se puede fumar dentro.", allowed: false },
  ],
  transport: [{ title: "Desde el aeropuerto o la estación", body: "" }],
  emergencyNote: "",
  checkoutSteps: ["Deja las llaves en...", "Saca la basura al contenedor de..."],
  faqs: [],
};

export async function POST(request: Request) {
  const hostId = await currentHostId();
  if (!hostId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos no válidos", detail: parsed.error.flatten() }, { status: 422 });
  }

  const repo = getRepo();
  const property: Property = {
    id: `prop_${nanoid(10)}`,
    hostId,
    /* Slug irreproducible: la guía es accesible por enlace, no adivinable. */
    slug: nanoid(8),
    ...parsed.data,
    hostName: "",
    hostPhone: "",
    wifiSsid: "",
    wifiPassword: "",
    wifiSecurity: "WPA",
    accessCode: "",
    accessCodeUpdatedAt: null,
    checkinFrom: "15:00",
    checkoutUntil: "11:00",
    contacts: [{ kind: "emergencias", phone: "112" }],
    defaultLocale: "es",
    published: false,
    pin: null,
  };

  await repo.createProperty(property);
  await repo.saveGuide(property.id, "es", { ...BLANK, welcomeTitle: `Bienvenido a ${property.name}` }, true);
  return NextResponse.json({ property });
}
