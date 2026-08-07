# Decisiones y descartes

Cada apartado dice qué había que decidir, qué elegí, qué descarté y qué me cuesta esa elección.
Están ordenadas por lo que más condiciona el producto.

## 1. Ordenar la guía por momentos de la estancia, no por categorías

**Contexto.** Un huésped abre la guía en tres situaciones muy distintas: antes de viajar, al llegar
con la maleta a la puerta y el último día por la mañana. Las tres necesitan cosas diferentes.

**Decisión.** Cinco fases (`antes`, `llegada`, `estancia`, `salida`, `despues`) que reordenan las
secciones. Ninguna sección se oculta: solo cambia de posición.

**Descartado.** Ocultar lo que no toca. Un huésped que busca el contenedor del vidrio el segundo día
no debería encontrarse con que la sección "existe pero hoy no". Esconder información en una casa
ajena genera más ansiedad que un scroll de más.

**Coste.** Hay que mantener cinco órdenes coherentes y probar la guía cinco veces. Para que se pueda
revisar sin manipular fechas, `?fase=` permite ver las cuatro versiones en treinta segundos.

## 2. El código de acceso no se serializa fuera de la ventana de la reserva

**Contexto.** La guía contiene la llave física de una casa habitada.

**Decisión.** El servidor decide si el código sale o no. Fuera de la ventana no viaja al navegador,
así que ni el HTML ni el código fuente lo contienen. Se suma identificador no adivinable (nanoid de
8), `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, `robots.txt` y PIN opcional.

**Descartado.** Ocultarlo con CSS o detrás de un `display:none`, que es lo cómodo y no protege nada.

**Coste.** En modo demostración las fechas de estancia están vacías, así que el código se ve; el
parámetro `?fase=antes` enseña el comportamiento real.

## 3. Zod como fuente única de verdad

**Decisión.** Un solo esquema valida el formulario del anfitrión, el cuerpo de las peticiones y el
JSONB que entra en PostgreSQL. Los tipos de TypeScript se derivan de él.

**Descartado.** Validar solo en cliente (se salta con `curl`) y solo en servidor (obliga a duplicar
las reglas en el formulario).

**Coste.** Cambiar un campo obliga a tocar el esquema, y esa es exactamente la intención.

## 4. PostgreSQL con SQL a mano, sin ORM

**Decisión.** `postgres.js` y consultas escritas. Cuatro tablas, claves foráneas con borrado en
cascada, `check` en los enumerados y los índices que el acceso real necesita.

**Descartado.** Prisma o Drizzle. En un esquema de cuatro tablas el ORM añade una capa de generación
de tipos, un paso de build y un motor de migraciones para resolver consultas que caben en diez
líneas de SQL legible. Con veinte tablas y varias personas tocando el esquema, la respuesta cambia.

**Coste.** El mapeo `snake_case` ↔ `camelCase` se escribe a mano; a cambio, la lista de columnas que
un PATCH puede tocar es explícita y no se puede colar una columna por accidente.

## 5. Hechos relacionales, texto multiidioma en JSONB

**Decisión.** Coordenadas, categorías, precios y teléfonos van en columnas (se filtran, se ordenan y
se calculan). El texto de la guía va en `jsonb` por idioma, validado antes de entrar.

**Descartado.** Normalizar cada párrafo en su fila: multiplicaría por cuatro las filas y por diez
los `JOIN` para consultar algo que siempre se lee entero y nunca por partes.

## 6. Capa de repositorio con modo demostración

**Decisión.** Un contrato con dos implementaciones. Sin `DATABASE_URL`, la app arranca con los datos
semilla en memoria y el panel funciona igual.

**Motivo.** Quien revisa esta prueba tiene varias candidaturas que mirar. Si abrir el proyecto exige
levantar una base de datos, la prueba se ve peor de lo que es.

**Coste.** Dos implementaciones que mantener. La interfaz avisa de que en modo demostración los
cambios se pierden al reiniciar, para que nadie confunda la demo con persistencia real.

## 7. Diccionarios propios en lugar de una librería de i18n

**Decisión.** Objetos tipados en `src/i18n/dictionaries.ts`. El diccionario español define el tipo;
si a un idioma le falta una clave, no compila.

**Descartado.** `next-intl` o `i18next`: unos 40 kB de JavaScript y configuración para resolver algo
que aquí son noventa claves y cuatro idiomas.

**Coste.** No hay pluralización ni formateo de fechas por locale. Si aparecieran, la librería pasaría
a compensar.

## 8. La traducción asistida entra como borrador

**Decisión.** El botón traduce del idioma original a otro, valida la respuesta contra el esquema y
la guarda con `reviewed = false`. El panel lo marca en rojo y la guía avisa al huésped.

**Motivo.** Una traducción automática sin revisar no debe pasar por buena en la casa de nadie, y el
anfitrión tiene derecho a saber qué texto ha escrito él y cuál no.

**Alternativa descartada.** Un chatbot de conserjería. Suena mejor en una demo, pero en una guía de
alojamiento un modelo generativo puede inventarse un horario o una dirección. Traducir es una tarea
acotada, verificable y con la mitad de riesgo: ahí sí aporta.

## 9. Leaflet a pelo, sin react-leaflet

**Decisión.** Cincuenta líneas con la API de Leaflet, importado dinámicamente y solo en cliente.

**Descartado.** `react-leaflet`, que añade una capa de compatibilidad que se rompe en cada versión
mayor de React. Y las APIs de mapas de pago, que aquí no aportan nada sobre OpenStreetMap.

## 10. Service worker escrito a mano

**Decisión.** Unas sesenta líneas con tres estrategias: red primero para las guías, caché primero
para estáticos y QR, siempre red para API y panel.

**Descartado.** `next-pwa`. Genera un service worker que nadie del equipo sabría depurar y arrastra
una configuración mayor que el archivo que sustituye.

## 11. Panel en español, guía en cuatro idiomas

**Decisión.** El anfitrión es cliente español y trabaja en español; el huésped puede venir de
cualquier sitio. Traducir el panel habría multiplicado por cuatro las cadenas sin servir a nadie.

## 12. Iconos propios en SVG

**Decisión.** Catorce iconos dibujados a mano, unos 2 kB en total, heredando `currentColor`.

**Descartado.** Una librería de iconos completa: cientos de kB y una dependencia más para catorce
formas que no van a cambiar.

## Lo que no está y es consciente

- **Reservas por huésped.** La ventana de estancia vive en el alojamiento, no en una reserva. Es el
  siguiente paso natural y el esquema ya está preparado.
- **Fotos en los pasos de entrada.** Una foto de la caja de llaves vale más que tres frases; falta
  el almacenamiento de imágenes.
- **Control de intentos distribuido.** El límite del PIN vive en memoria del proceso: con varias
  instancias hay que moverlo a la base de datos o a Redis. Anotado en el código.
- **Pruebas automatizadas.** Hay un guion de humo (`scripts/smoke.sh`) que verifica autenticación,
  autorización, validación, límite de intentos y que el código de acceso no se filtre. Con más
  tiempo, Vitest para `geo`, `stay` y `completeness`, que son lógica pura y fácil de fijar.

---

# Segunda iteración (6 de agosto)

## 13. La reserva como entidad, y el enlace que caduca

**Contexto.** El fallo de diseño de la primera versión: la URL de una guía era una credencial sin
caducidad. Quien la tuvo una vez la tenía para siempre, con el código de la puerta dentro.

**Decisión.** Las fechas dejan de colgar del alojamiento y pasan a la reserva. Cada reserva estrena
enlace, se revoca por separado y, fuera de su ventana, el servidor deja de serializar el código de
entrada y la clave del WiFi. La guía no se apaga: se degrada.

**Consecuencia buscada.** Un enlace filtrado se agota con su propia reserva, y se sabe de qué
huésped salió.

**Límite reconocido.** Nada de esto impide una captura de pantalla. El objetivo es reducir la
ventana de exposición, no declararla imposible.

## 14. Dos tipos de enlace

**Decisión.** El slug del alojamiento y el slug de la reserva se resuelven en la misma ruta pero dan
guías distintas: el del alojamiento es el que se pega en el anuncio y nunca enseña lo que abre la
casa; el de la reserva es el del QR de la nevera.

**Por qué importa.** Sin esa separación, cualquier anfitrión que quisiera enseñar su guía a un
posible huésped tendría que enseñarle también el código de la puerta.

## 15. Las traducciones dejan de necesitar revisión humana

**Contexto.** La primera versión marcaba en rojo las traducciones sin revisar. Un anfitrión que no
habla francés no puede revisar el francés: era una tarea imposible y permanente en su panel.

**Decisión.** Al publicar se generan los cuatro idiomas. El estado "revisada" desaparece de la
interfaz y de la puntuación de completitud; se conserva en la base de datos por si algún día el
anfitrión quiere repasar el idioma que sí domina. La guía avisa al huésped con una línea a pie de
página.

**Descartado.** Exigir revisión antes de publicar, que habría dejado a la mayoría de los anfitriones
con guías monolingües para siempre.

## 16. Un asistente de IA, y solo en el editor

**Decisión.** La IA ordena y traduce lo que el anfitrión ha escrito, con una persona que lee la
sugerencia y decide. En la guía del huésped no hay chat.

**Por qué.** Si un modelo se inventa el horario de una farmacia ante un huésped, el responsable es
el anfitrión. En el editor el error se corrige antes de publicar; en la guía, no. El prompt prohíbe
inventar datos y deja huecos entre corchetes cuando falta información.

**Sustituto en la guía.** El buscador determinista, que solo encuentra lo que el anfitrión escribió,
y un botón para preguntar directamente al anfitrión cuando no hay resultado.

## 17. Importar desde Airbnb: comprobado que no se puede

**Hallazgo.** En 2026 la API de Airbnb sigue restringida a socios aprobados y el programa está
cerrado a solicitudes no invitadas. Las alternativas son scrapers de terceros: contra los términos
de servicio, frágiles y jurídicamente turbios.

**Decisión.** No se integra. El problema real —que rellenar la guía cansa— se ataca por otro lado:
geocodificación de la dirección con Nominatim (sin clave, sin cuota) para que el anfitrión no vea
nunca un campo de latitud, y una guía en blanco pero con la estructura ya puesta.

## 18. Métricas sin identificar a nadie

**Decisión.** Contadores agregados por alojamiento, día, tipo y valor. Sin cookies, sin huella de
dispositivo, sin IP y sin identificador de huésped.

**Por qué así.** Al anfitrión le sirve "el 60% de mis huéspedes abre la guía en inglés", no "Claire
miró las normas a las 23:40". Agregar por alojamiento mantiene esto lejos de ser dato personal, que
es donde queremos estar. La métrica más útil resultó ser la más barata: qué buscó el huésped y no
encontró, que le dice al anfitrión qué falta en su guía con las palabras del propio huésped.

## 19. El recuerdo del viaje se compone en el móvil

**Decisión.** Cuando la reserva termina, la guía muestra el resumen del viaje —sitios marcados,
noches, kilómetros estimados— y permite componer una tarjeta con una foto del huésped.

**Restricción autoimpuesta.** La foto nunca sube al servidor: se dibuja en un canvas local y se
descarga desde ahí. Sin almacenamiento, sin coste y sin un solo problema de protección de datos. Es
la única forma honesta de ofrecer algo compartible en una app que presume de no pedirle nada a quien
la abre.

## 20. Entrar con Google: pendiente, y con una precisión

Entrar con Google es OAuth 2.0 / OpenID Connect; el JWT es el formato del token con el que después
se mantiene la sesión, que es lo que la app ya hace con `jose`. No son alternativas, son dos capas
distintas. La integración está pendiente y no cambia nada de lo anterior: se apoya sobre la sesión
que ya existe. El acceso con correo y contraseña sigue siendo el camino principal, entre otras cosas
porque es el que permite entrar con la cuenta de demostración.
