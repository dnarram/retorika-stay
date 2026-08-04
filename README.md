# Retorika Stay

Guía digital para huéspedes de alojamientos turísticos. El anfitrión rellena una plantilla una vez;
el huésped abre un QR y encuentra la entrada, el WiFi, las normas, las recomendaciones del anfitrión
y a quién llamar si algo va mal, en su idioma y sin instalar nada.

Prueba técnica para el proceso de selección de **Retorika Academy** · David Naranjo Ramírez · agosto de 2026.

---

## Arrancarlo en quince segundos

```bash
npm install
npm run dev
```

No hace falta base de datos: sin `DATABASE_URL` la app arranca en **modo demostración** con dos
alojamientos cargados y el panel completamente usable (los cambios viven en memoria hasta reiniciar).

Con PostgreSQL:

```bash
cp .env.example .env      # rellena DATABASE_URL y AUTH_SECRET
npm run db:migrate        # aplica db/schema.sql
npm run db:seed           # carga los dos alojamientos de ejemplo
npm run dev
```

**Acceso al panel:** `belen@retorika.es` / `retorika2026`

---

## Guion de revisión de tres minutos

| # | Abre esto | Qué se ve |
|---|---|---|
| 1 | `/g/k3f9apx2` | Guía del huésped (Ronda). Barra de cuatro acciones críticas, código de acceso oculto tras un toque, QR de WiFi. |
| 2 | `/g/k3f9apx2?fase=antes` | **La misma guía reordenada** para alguien que aún no ha llegado, y el código de la puerta ya no está ni en el HTML. Al final de la página hay un selector para ver las cuatro fases. |
| 3 | `/g/k3f9apx2?lang=fr` | Cuatro idiomas: español, inglés, francés y portugués. |
| 4 | `/g/m7q2ldv5` | Guía protegida con PIN (**2610**). Sin PIN no llega ni una línea de contenido al navegador. |
| 5 | `/panel` | Panel del anfitrión: completitud ponderada, qué falta y por qué importa. |
| 6 | `/panel/prop_madrid` → paso 7 | Estado de las traducciones: francés y portugués marcados como borrador, y el aviso que eso provoca en la guía del huésped. |
| 7 | Modo avión + recargar `/g/k3f9apx2` | La guía sigue abriéndose: se guardó en el móvil en la primera visita. |

---

## Cómo responde a los cuatro criterios del encargo

| Criterio | Decisiones concretas |
|---|---|
| **Funcional** | Copiar la clave del WiFi, QR que conecta el móvil a la red, llamada al 112 en un toque, cómo llegar en Maps, checklist de salida que recuerda lo marcado, buscador, versión imprimible y funcionamiento sin conexión. |
| **Intuitiva** | La guía se reordena según el día de la estancia: quien todavía no ha llegado ve la dirección y la entrada; quien se va hoy, la hora de salida. Ninguna sección se oculta nunca, solo cambia de sitio. Las cuatro acciones críticas viven en la cabecera. |
| **Visualmente atractiva** | Paleta e identidad de Retorika con el color como información y no como adorno: azul para acciones, fucsia solo para urgencia y alertas, verde solo para confirmaciones. Tipografía geométrica en titulares, siguiendo el trazo del logo. |
| **Bien estructurada** | Un esquema Zod como fuente única de verdad para formulario, API y base de datos. Capa de repositorio con dos implementaciones. Hechos en tablas relacionales, texto multiidioma en JSONB. Decisiones documentadas en [`DECISIONES.md`](./DECISIONES.md). |

---

## Las seis decisiones de producto

1. **Arquitectura por momentos, no por categorías.** Un huésped a las 23:40 con una maleta necesita
   el código de la puerta; el del último día necesita saber qué hacer con la basura. La guía se
   recoloca sola según la fase de la estancia (`src/lib/stay.ts`).
2. **El código de la puerta es la llave de una casa real.** Fuera de la ventana de la reserva no se
   serializa: no está oculto por CSS, no existe en el HTML. La guía nunca se indexa (`X-Robots-Tag`
   más `robots.txt`), el identificador no es adivinable y el anfitrión puede añadir un PIN.
3. **Sin conexión.** Quien aterriza de otro país llega sin datos. Un service worker propio guarda la
   guía en la primera visita, que es cuando el huésped todavía tiene el wifi del aeropuerto.
4. **Cuatro idiomas de verdad.** Español, inglés, francés y portugués, detectados desde el navegador.
   Las categorías y los tipos de contacto son enumerados, así que un dato que el anfitrión escribe
   una vez sale traducido a los cuatro idiomas sin que él haga nada.
5. **Las distancias se calculan, no se teclean.** Los minutos a pie salen de las coordenadas
   (Haversine con factor de rodeo de 1,3 y ritmo de paseo con maleta), así que ninguna traducción se
   queda con una distancia obsoleta.
6. **La IA traduce, no redacta.** El botón de traducir nunca inventa contenido, valida la respuesta
   contra el mismo esquema Zod y marca el resultado como borrador hasta que una persona lo repasa.
   Sin clave de API la app funciona igual: solo se apaga ese botón.

---

## Arquitectura

```
src/
├─ app/
│  ├─ g/[slug]/          Guía del huésped (servidor decide idioma, fase y qué datos salen)
│  ├─ panel/             Panel del anfitrión: login, listado y editor por pasos
│  └─ api/               qr · unlock · auth · properties · guides · places · translate
├─ lib/
│  ├─ schema.ts          Esquema Zod: formulario, API y base de datos comparten definición
│  ├─ repo.ts            Contrato de datos con implementación PostgreSQL y modo demostración
│  ├─ stay.ts            Fases de la estancia y visibilidad del código de acceso
│  ├─ geo.ts             Haversine, minutos a pie, enlaces a mapas
│  ├─ completeness.ts    Completitud ponderada por lo que le importa al huésped
│  └─ auth.ts            scrypt + JWT en cookie httpOnly
├─ i18n/dictionaries.ts  ES · EN · FR · PT tipados (si falta una clave, no compila)
└─ data/seed.ts          Dos alojamientos de ejemplo
db/schema.sql            DDL de PostgreSQL comentado
```

Next.js 15 (App Router) · TypeScript en modo estricto · Tailwind CSS 4 · PostgreSQL con
[postgres.js](https://github.com/porsager/postgres) · Leaflet sobre OpenStreetMap · Zod · jose.
Sin ORM y sin librería de i18n, iconos ni QR en el cliente: cada dependencia que no está es una
dependencia que no hay que mantener. La guía del huésped carga **113 kB** de JavaScript.

---

## Seguridad y privacidad

- Contraseñas con `scrypt` (sal por usuario, comparación en tiempo constante).
- Sesión en cookie `httpOnly` + `sameSite=lax`, firmada con HS256.
- Autorización comprobada en cada ruta: un anfitrión no accede a la ficha de otro cambiando el id.
- Toda escritura se valida con Zod en el servidor; los datos no válidos devuelven 422.
- PIN limitado a cinco intentos por IP y alojamiento cada diez minutos (cuatro cifras son diez mil
  combinaciones: sin freno, un script las agota).
- La guía no pide ningún dato al huésped: sin cuentas, sin analítica, sin cookies de terceros. Lo
  único que se guarda en su móvil es qué pasos de la salida ha marcado.

## Accesibilidad

Contraste AA sobre los colores corporativos, foco visible en todos los controles, enlace de salto al
contenido, `prefers-reduced-motion` respetado, HTML semántico (`details`, `nav`, `progressbar`) y
estados que nunca dependen solo del color: cada norma lleva icono y etiqueta además del color.

---

## Verificación

`scripts/smoke.sh` levanta la app y comprueba lo que no puede fallar. Salida de la última ejecución:

```
PIN incorrecto -> 401          PIN correcto -> 200
PATCH sin sesión -> 401        login clave mala -> 401
login correcto -> 200          PATCH válido -> 200
PATCH lat=999 -> 422           traducir sin clave -> 501
fase=antes: código de acceso en el HTML -> 0 ocurrencias
X-Robots-Tag: noindex, nofollow, noarchive
rate limit PIN: 401 401 401 401 401 429
```

`npx tsc --noEmit` y `npx next build` pasan sin avisos.

---

## Qué haría a continuación

Con más tiempo, por este orden: reservas reales con fechas por huésped (hoy la ventana de estancia
está en el propio alojamiento), subida de fotos para los pasos de entrada, mover el control de
intentos del PIN a la base de datos para que aguante varias instancias, y un panel de dudas
frecuentes que aprenda de lo que el huésped busca en el buscador y no encuentra.
