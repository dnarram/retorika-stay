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
npm run db:migrate        # aplica db/schema.sql (o db/migrations/ si ya existía)
npm run db:seed           # carga los dos alojamientos de ejemplo
npm run dev
```

**Acceso al panel:** `belen@retorika.es` / `retorika2026`

---

## Guion de revisión de tres minutos

| # | Abre esto | Qué se ve |
|---|---|---|
| 1 | `/` | Portada: propuesta de valor, entrar y crear cuenta. Botón para rellenar la cuenta de demostración. |
| 2 | `/g/r7d3ka92` | Guía de una **reserva en curso**. Barra de cuatro acciones, código de entrada tras un toque, QR de WiFi. |
| 3 | `/g/k3f9apx2` | **Enlace de muestra** del mismo piso: la guía entera menos lo que abre la casa. Se puede pegar en el anuncio. |
| 4 | `/g/mv8ktp41` | Reserva **ya terminada**: la guía sigue viva, el código de entrada y la clave del WiFi ya no existen en el HTML. |
| 5 | `/g/r5xw81nq` | Reserva futura **con PIN** (2610): sin PIN no baja ni una línea de contenido. |
| 6 | `/g/r7d3ka92?fase=recuerdo` | Modo recuerdo: resumen del viaje y tarjeta compartible. La foto se compone en el móvil y no se sube a ningún sitio. |
| 7 | `/g/r7d3ka92?lang=fr` | Cuatro idiomas, con aviso de traducción automática. |
| 8 | `/panel` | Tarjetas de alojamientos, reservas con su enlace, aviso de rotación del código, métricas anónimas y alta de alojamiento con búsqueda de coordenadas. |
| 9 | Modo avión + recargar una guía | Sigue abriéndose: se guardó en el móvil en la primera visita. |

## Cómo responde a los cuatro criterios del encargo

| Criterio | Decisiones concretas |
|---|---|
| **Funcional** | Copiar la clave del WiFi, QR que conecta el móvil a la red, llamada al 112 en un toque, cómo llegar en Maps, checklist de salida, buscador, compartir con el menú nativo del móvil, elegir qué secciones imprimir y funcionamiento sin conexión. |
| **Intuitiva** | La guía se reordena según el día de la reserva: quien no ha llegado ve la dirección y la entrada; quien se va hoy, la salida; quien ya se fue, el resumen del viaje. Ninguna sección se oculta, solo cambia de sitio. El anfitrión escribe su dirección y las coordenadas se buscan solas. |
| **Visualmente atractiva** | Paleta e identidad de Retorika con el color como información y no como adorno: azul para acciones, fucsia solo para urgencia y alertas, verde solo para confirmaciones. Tipografía geométrica en titulares, siguiendo el trazo del logo. |
| **Bien estructurada** | Un esquema Zod como fuente única de verdad para formulario, API y base de datos. Capa de repositorio con dos implementaciones. Cinco tablas: hechos relacionales, texto multiidioma en JSONB. Decisiones y descartes documentados en [`DECISIONES.md`](./DECISIONES.md). |

---

## Las seis decisiones de producto

1. **Arquitectura por momentos, no por categorías.** Un huésped a las 23:40 con una maleta necesita
   el código de la puerta; el del último día necesita saber qué hacer con la basura. La guía se
   recoloca sola según la fase de la estancia (`src/lib/stay.ts`).
2. **El enlace de una guía caducaba nunca, y eso era un fallo de diseño.** Ahora cada reserva tiene
   su propio enlace: se revoca por separado y, cuando el huésped se va, el servidor deja de enviar
   el código de entrada y la clave del WiFi. No están ocultos por CSS: no existen en el HTML. El
   enlace del alojamiento es distinto —el que se pega en el anuncio— y nunca los enseña. La guía no
   se indexa (`X-Robots-Tag` y `robots.txt`), el identificador no es adivinable y se puede poner PIN
   por reserva. Nada de esto impide una captura de pantalla, y no lo pretende: reduce la ventana de
   exposición de "para siempre" a "los días de la reserva".
3. **Sin conexión.** Quien aterriza de otro país llega sin datos. Un service worker propio guarda la
   guía en la primera visita, que es cuando el huésped todavía tiene el wifi del aeropuerto.
4. **Cuatro idiomas sin pedirle imposibles al anfitrión.** Español, inglés, francés y portugués,
   detectados desde el navegador y generados al publicar. No se le pide que "revise" un idioma que
   no habla: la guía avisa al huésped de que la traducción es automática y ahí acaba el asunto.
5. **Las distancias se calculan, no se teclean.** Los minutos a pie salen de las coordenadas
   (Haversine con factor de rodeo de 1,3 y ritmo de paseo con maleta), así que ninguna traducción se
   queda con una distancia obsoleta.
6. **La IA vive en el editor, no en la guía.** Traduce y ordena las notas del anfitrión, con un
   humano que lee y decide antes de publicar. En la guía del huésped no hay chat: hay un buscador
   determinista que no puede inventarse el horario de una farmacia. Sin clave de API la app funciona
   igual: solo se apagan esos botones.

7. **Analítica sin analítica.** Contadores agregados por alojamiento: aperturas, idiomas y —la más
   útil— qué buscó el huésped y no encontró. Sin cookies, sin identificador de dispositivo y sin
   preguntarle nada a quien abre la guía.

---

## Arquitectura

```
src/
├─ app/
│  ├─ g/[slug]/          Guía del huésped: el slug resuelve reserva o alojamiento, y el
│  │                     servidor decide idioma, fase y qué datos pueden salir
│  ├─ panel/             Panel del anfitrión: login, listado y editor por pasos
│  └─ api/               qr · unlock · auth (login/registro) · properties · stays ·
│                        guides · places · translate · assist · geocode · track
├─ lib/
│  ├─ schema.ts          Esquema Zod: formulario, API y base de datos comparten definición
│  ├─ repo.ts            Contrato de datos con implementación PostgreSQL y modo demostración
│  ├─ stay.ts            Ciclo de vida de la reserva y visibilidad del código de acceso
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

`npm run smoke` levanta la app compilada y comprueba lo que no puede fallar. Última ejecución:

```
enlace de muestra: código de entrada en el HTML        0 ocurrencias
enlace de muestra: clave del WiFi en el HTML           0 ocurrencias
reserva en curso: código presente                      1
reserva terminada: código y clave del WiFi             0 y 0
reserva futura con PIN: contenido servido              0
PATCH / crear alojamiento / crear reserva sin sesión   401 401 401
login mal 401 · bien 200 · portada con sesión          307 al panel
PATCH lat=999 → 422    registro clave corta → 422    correo repetido → 409
reserva con salida anterior a la llegada → 422
asistente y traducción sin clave → 501 (la app sigue funcionando)
métrica anónima → 204   tipo de métrica inventado → 400
X-Robots-Tag: noindex, nofollow, noarchive
límite de intentos del PIN: 401 401 401 401 401 429
```

`npx tsc --noEmit` y `npx next build` pasan sin avisos.

Dos integraciones no se pueden verificar desde el entorno de desarrollo porque llaman a servicios
externos: la geocodificación de Nominatim y las llamadas a Groq (traducción y asistente). Ambas
están escritas para fallar sin romper nada —el anfitrión puede seguir escribiendo las coordenadas a
mano y los botones de IA devuelven un aviso claro— y hay que probarlas contra el despliegue real.

## Qué haría a continuación

Por este orden: entrada con Google (OAuth 2.0 sobre la sesión JWT que ya existe), fotos en los pasos
de entrada, sugerencia automática de sitios cercanos al crear un alojamiento, mover el control de
intentos del PIN a la base de datos para que aguante varias instancias, y varias guías por
alojamiento —el esquema lo admite, pero no expongo la jerarquía hasta tener un caso de uso claro:
añadirle un nivel al anfitrión al que le prometemos sencillez hay que ganárselo.
