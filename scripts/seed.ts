/* Loads the demo data. Usage: npm run db:seed */
import postgres from "postgres";
import { GUIDES, HOSTS, PLACES, PROPERTIES, STAYS } from "../src/data/seed.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

const sql = postgres(url, { ssl: url.includes("sslmode=require") ? "require" : undefined });

await sql.begin(async (tx) => {
  for (const host of HOSTS) {
    await tx`insert into hosts (id, email, name, password_hash)
             values (${host.id}, ${host.email}, ${host.name}, ${host.passwordHash})
             on conflict (id) do update set password_hash = excluded.password_hash`;
  }

  for (const p of PROPERTIES) {
    await tx`insert into properties (id, host_id, slug, name, city, address, lat, lng, host_name,
              host_phone, wifi_ssid, wifi_password, wifi_security, access_code, checkin_from,
              checkout_until, contacts, default_locale, published, pin)
             values (${p.id}, ${p.hostId}, ${p.slug}, ${p.name}, ${p.city}, ${p.address}, ${p.lat},
              ${p.lng}, ${p.hostName}, ${p.hostPhone}, ${p.wifiSsid}, ${p.wifiPassword},
              ${p.wifiSecurity}, ${p.accessCode}, ${p.checkinFrom}, ${p.checkoutUntil},
              ${tx.json(p.contacts)}, ${p.defaultLocale},
              ${p.published}, ${p.pin})
             on conflict (id) do nothing`;
  }

  for (const stay of STAYS) {
    await tx`insert into stays (id, property_id, slug, guest_name, arrival, departure, pin)
             values (${stay.id}, ${stay.propertyId}, ${stay.slug}, ${stay.guestName},
              ${stay.arrival}, ${stay.departure}, ${stay.pin})
             on conflict (id) do nothing`;
  }

  for (const g of GUIDES) {
    await tx`insert into guides (property_id, locale, content, reviewed)
             values (${g.propertyId}, ${g.locale}, ${tx.json(g.content)}, ${g.reviewed})
             on conflict (property_id, locale) do update set content = excluded.content`;
  }

  for (const [index, place] of PLACES.entries()) {
    await tx`insert into places (id, property_id, category, name, lat, lng, price, url, phone, notes, sort_order)
             values (${place.id}, ${place.propertyId}, ${place.category}, ${place.name}, ${place.lat},
              ${place.lng}, ${place.price}, ${place.url}, ${place.phone}, ${tx.json(place.notes)}, ${index})
             on conflict (id) do nothing`;
  }
});

console.log(`Seeded ${PROPERTIES.length} properties, ${STAYS.length} bookings, ${GUIDES.length} guides and ${PLACES.length} places.`);
await sql.end();
