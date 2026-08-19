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

/* The one string a blank guide ships with, so it arrives in the same language
   as everything around it. */
const WELCOME: Record<Property["defaultLocale"], string> = {
  es: "Bienvenido a",
  en: "Welcome to",
  fr: "Bienvenue à",
  pt: "Bem-vindo a",
};

export async function POST(request: Request) {
  const hostId = await currentHostId();
  if (!hostId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos no válidos", detail: parsed.error.flatten() }, { status: 422 });
  }

  /* Guides are authored in Spanish in this version and translated from there.

     A cookie used to decide this, left over from a language picker that was
     meant to switch the whole app — a feature we deliberately did not build,
     because the host interface stays Spanish for now. Half-built, it did real
     damage: a host who once read a guide in Portuguese got every property they
     created afterwards marked Portuguese, for a year, with no way to see why.

     One authoring language, stated in one place. When the host interface is
     translated, this is the line that changes. */
  const hostLocale: Property["defaultLocale"] = "es";

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
    visitedSteps: [],
    theme: DEFAULT_THEME,
    /* The language the host chose on the way in, rather than a question asked
       again halfway through the editor. */
    defaultLocale: hostLocale,
    published: false,
    pin: null,
  };

  await repo.createProperty(property);

  /* THE GUIDE IS CREATED IN THE HOST'S LANGUAGE.

     It used to be hardcoded to Spanish while the property recorded whichever
     language the host had chosen, so the two could disagree — and did. A host
     whose cookie said Portuguese got a property marked Portuguese, a guide
     written in Spanish, an editor labelled in Portuguese, and a panel promising
     to translate from Portuguese. Every one of those was reading a different
     field. One language, written once, in both places. */
  await repo.saveGuide(
    property.id,
    hostLocale,
    { ...BLANK, welcomeTitle: `${WELCOME[hostLocale]} ${property.name}` },
    true,
  );
  return NextResponse.json({ property });
}
