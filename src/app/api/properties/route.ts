import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { currentHostId } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import type { Guide, Property } from "@/lib/schema";
import { DEFAULT_THEME } from "@/lib/theme";

const bodySchema = z.object({
  name: z.string().min(2).max(80),
  city: z.string().min(2).max(80),
  address: z.string().min(4).max(160),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/* A blank guide that is not empty: the host starts with the structure already
   in place and only has to fill it in. A good template removes more friction
   than any automatic import would. */
const BLANK: Guide = {
  welcomeTitle: "",
  welcomeIntro: "",
  arrivalSteps: [""],
  parking: "",
  wifiNote: "",
  /* No pre-made empty rows. A guide that arrives with three headings and no
     text under them looks unfinished to the guest and gives the host three
     things to delete. The editor offers the same titles as one-tap chips
     instead, so the suggestion is there without the debris. */
  house: [],
  rules: [
    { text: "Silencio de 23:00 a 8:00.", allowed: null },
    { text: "No se puede fumar dentro.", allowed: false },
  ],
  transport: [],
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
  /* The host is logged in, so their name is already known: asking for it again
     is friction with nothing on the other side. */
  const account = await repo.getHostById(hostId);

  const property: Property = {
    id: `prop_${nanoid(10)}`,
    hostId,
    /* Unguessable slug: the guide is reachable by link, not by guessing. */
    slug: nanoid(8),
    ...parsed.data,
    hostName: account?.name ?? "",
    hostPhone: "",
    wifiSsid: "",
    wifiPassword: "",
    wifiSecurity: "WPA",
    accessCode: "",
    accessCodeUpdatedAt: null,
    checkinFrom: "15:00",
    checkoutUntil: "11:00",
    contacts: [{ kind: "emergency", phone: "112" }],
    hiddenSections: [],
    theme: DEFAULT_THEME,
    defaultLocale: "es",
    published: false,
    pin: null,
  };

  await repo.createProperty(property);
  await repo.saveGuide(property.id, "es", { ...BLANK, welcomeTitle: `Bienvenido a ${property.name}` }, true);
  return NextResponse.json({ property });
}
