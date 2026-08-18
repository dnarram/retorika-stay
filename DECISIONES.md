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

---

# Tercera iteración (6 de agosto)

## 21. El código y sus comentarios pasan al inglés

**Decisión.** Comentarios, mensajes de consola y vocabulario del dominio en inglés. La interfaz del
anfitrión sigue en español, la guía del huésped en cuatro idiomas y esta documentación en español.

**Alcance real.** No fue solo traducir comentarios: los enumerados del dominio estaban en español y
viajaban hasta las restricciones `check` de PostgreSQL. `category: "comer"` pasó a `"restaurant"`,
`kind: "emergencias"` a `"emergency"`, las fases de la reserva a `before / arrival / staying /
departure / memories` y los tipos de métrica a `open / language / section / search_miss / call`.
Media medida —comentarios en inglés y literales en español— habría quedado peor que no haber
empezado.

**Coste.** Toca el esquema, así que hay migración. Se hizo antes de que existan datos reales, que es
justo cuando sale gratis.

## 22. Verificado contra PostgreSQL de verdad

**Contexto.** Toda la capa de datos estaba escrita y ninguna consulta se había ejecutado nunca. El
modo demostración daba una falsa sensación de cobertura: pasaba la batería entera sin tocar SQL.

**Qué apareció al ejecutarla contra PostgreSQL 16.**

1. `postgres.js` rechaza un script con `begin`/`commit` dentro de `unsafe()`. Hace falta `max: 1` en
   la conexión y el protocolo simple, que es el único que acepta varias sentencias por llamada.
2. Las columnas `date` vuelven como objetos `Date` de JavaScript. `String(fecha).slice(0, 10)` daba
   `"Wed Aug 06"` en lugar de `"2026-08-06"`, y con eso se caía toda la aritmética del ciclo de vida
   de la reserva: la guía de una estancia en curso devolvía un 500.

**Lección que me llevo.** Una capa de abstracción con dos implementaciones es cómoda para el que
revisa el proyecto, pero puede esconder que una de las dos nunca se ha ejecutado. La batería ahora
se pasa en los dos modos y cubre el camino de escritura completo, incluido el borrado en cascada
comprobado con SQL.

## 23. Entrar con Google, escrito a mano

**Decisión.** El flujo OAuth 2.0 / OpenID Connect implementado directamente contra los endpoints de
Google, sobre la sesión JWT que la app ya tenía.

**Descartado.** NextAuth: una dependencia, un adaptador y una capa de configuración para sustituir
unas cien líneas que merece la pena leer. Aquí está el flujo entero, incluidas las dos protecciones
que más se saltan: `state` firmado en cookie y en URL contra CSRF en el callback, y `nonce` que ata
el ID token a esa petición concreta. El ID token se verifica contra las claves públicas de Google,
no se decodifica y se cree; se comprueban emisor, audiencia, nonce y que el correo esté verificado.

**Comportamiento sin credenciales.** El botón no se renderiza, `/api/auth/google` redirige a la
portada y el callback rechaza cualquier `state` que no coincida. Correo y contraseña siguen siendo
el camino principal, entre otras cosas porque es el único que permite entrar con la cuenta de
demostración.

---

# Cuarta iteración (12–18 de agosto)

## 24. El aspecto de la guía se elige entre opciones compuestas, no con un selector libre

Un anfitrión no es diseñador y no quiere serlo esa tarde. Un selector de color abierto y un menú de tipografías le permiten construir algo ilegible en noventa segundos —gris medio sobre gris claro, una tipografía de titular a tamaño de texto— y después culpar a la app.

Son cuatro decisiones, cada una entre opciones que ya funcionan juntas: **seis paletas**, **cuatro parejas tipográficas** mostradas cada una en su propia letra, **tres radios de esquina** y **cuatro estilos de sección**. Cualquier combinación de las cuatro produce una guía presentable.

Dos límites que el anfitrión no puede romper: los **colores semánticos no cambian** —el fucsia sigue siendo urgencia y el verde confirmación en todas las paletas, porque quien lee «Emergencias» a las dos de la mañana no debería reaprender qué significa el rojo— y el **contraste está fijado en la composición**, así que no existe combinación ilegible.

**Descartado**: subir un logotipo propio y elegir color libre. Es lo que pediría un anfitrión y lo que hundiría la calidad media del producto.

## 25. Un único envoltorio lleva el tema, sin una sola clase condicional

Las utilidades de Tailwind leen variables CSS (`--color-brand`, `--font-display`, `--radius-card`). Sobrescribirlas en un `<div>` contenedor hace que `bg-brand` dentro resuelva al color de *ese* alojamiento. Cero lógica condicional en los componentes y cero hojas de estilo por tema.

La tipografía elegida se carga con un `<link>` que React eleva a `<head>`: un huésped descarga la pareja que su guía usa y ninguna otra.

## 26. Las texturas decorativas se sustituyen por tratamientos de sección

La primera versión ofrecía patrones de fondo. Eran decoración sin nada que decir y se notaba. Lo que da carácter a un manual de bienvenida impreso no es un patrón detrás del título: es **cómo se compone el título, qué marca acompaña a cada rótulo y qué separa una cosa de la siguiente**.

Cuatro direcciones —Sereno, Editorial, Banda y Sello— que cambian esas tres cosas a la vez, más el icono de cada sección en su rótulo. Ninguna cambia una palabra del contenido ni el orden de lectura.

## 27. Apagar una sección no es borrarla

El anfitrión desmarca lo que no quiere enseñar y el contenido **permanece en la base de datos**, listo para volver. Quien lleva un piso sin normas no debería tener que borrarlas para dejar de mostrarlas.

«Cómo llegar» no aparece en esa lista: una guía sin dirección no es una guía.

## 28. Una sección se marca completa solo si el anfitrión la ha abierto

El progreso se calculaba por contenido, y las guías nacen con normas y pasos de salida de plantilla. Un anfitrión veía secciones tachadas sin haber leído una línea.

Ahora hace falta **contenido y visita**: `properties.visited_steps` registra los pasos que el editor abrió de verdad. Contenido prerrelleno que nadie ha visto es una sugerencia, no una sección terminada. Y de paso resultó ser el dato que hace medible el abandono del editor en el panel de negocio.

## 29. La opinión del huésped se pregunta una vez y de una manera

Descartados los pulgares: un pulgar hacia abajo invita a puntuar la escritura del anfitrión, que no es la pregunta útil. La pregunta útil es **«¿te ha servido?»**, porque un «no» en Normas dice exactamente qué reescribir.

Se pregunta **por sección en modo iconos y una sola vez al final en modo lectura**, nunca las dos cosas: preguntar por la sección y por la guía en la misma pantalla convierte una cortesía en una encuesta. No vuelve a preguntar en ese dispositivo.

## 30. Las visitas del propietario no cuentan en ninguna métrica

Un anfitrión abriendo su propia guía está revisando su trabajo, no usándola. Cada previsualización estaba inflando su propio panel.

El filtro está **en el servidor**, en `/api/track`: el beacon lleva la cookie de sesión, así que la propiedad se establece desde la sesión y no desde algo que la página pueda afirmar. Y es deliberadamente estrecho —excluye al dueño **de esa** propiedad, no a cualquiera con cuenta—: quien es anfitrión en Ronda y huésped en Madrid cuenta como huésped en Madrid.

## 31. El panel del anfitrión responde a cuatro preguntas, no muestra doce contadores

`¿Llega?` · `¿Sirve?` · `¿Ahorra trabajo?` · `¿Se comparte?` Cada bloque responde en una frase y los números sostienen la frase, no al revés.

**Descartadas por medir mal**: el tiempo medio de lectura (quien encuentra el WiFi en ocho segundos es el mejor caso posible y saldría como el peor dato del mes) y la tasa de finalización (una guía no es un curso; nadie debe leerla entera).

**Descartada por no ser medible**: la reducción de preguntas por WhatsApp. En su lugar, un **índice de fricción** —llamadas + búsquedas sin resultado + «no me sirvió»— presentado como tendencia mes a mes y explicado como aproximación, nunca como la cifra real.

## 32. El panel de negocio dice qué no mide y por qué

MRR, CAC, LTV, NPS y coeficiente viral no se pueden calcular sin pasarela de pago, inversión declarada, encuesta ni programa de referidos. **Un número inventado en un panel de negocio es peor que un hueco**: alguien acaba planificando con él.

Lo que sí se mide está construido como análisis y no como niveles: embudo con conversión escalón a escalón, mediana —no media— hasta la primera guía comparada entre cohortes, abandono por paso del editor, retención por cohorte y origen del registro. Cada bloque lleva una línea **«De dónde sale»** en castellano llano, porque un administrador no es programador.

El origen `guia` es el bucle de crecimiento propio del producto: alguien que leyó un manual de bienvenida y volvió para hacer el suyo.

## 33. El recuerdo se compone por secciones y nunca mezcla fotos entre ellas

Una versión anterior rellenaba diapositivas flojas reutilizando fotos de otras secciones, y se leía como lo que era: un generador quedándose sin material.

Ahora **el número de fotos de cada sección elige su composición**: una foto recibe marco, garabato y una frase de viaje; varias generan un collage construido solo con las suyas. La única excepción es el antes/después, que enfrenta «La llegada» con «La despedida» porque eso sí es una idea y no un relleno.

Nada se sube a ningún servidor: todo se dibuja en un lienzo local.

## 34. Una descarga, no nueve

Descargar nueve imágenes seguidas provocaba dos problemas: los navegadores agrupan las descargas programáticas y piden permiso —a veces dos veces—, y revocar cada `objectURL` justo después del clic mataba descargas a medias. Faltaba siempre una imagen distinta.

Se sustituye por **un ZIP escrito a mano**, cien líneas sin dependencias, con las entradas **almacenadas sin comprimir** porque el contenido ya es JPEG. Una descarga, un permiso, nada que se pierda.

**Descartado**: entregar el archivo directamente a la hoja de compartir en el móvil. Pedirle a alguien que publique algo que aún no ha visto es fricción, no ayuda.

## 35. El buscador busca en toda la guía

Prometía la guía y solo miraba el nombre y la nota de las recomendaciones: «restaurantes» no encontraba los restaurantes porque la categoría nunca estaba en el índice, y «banos arabes» sin acentos no encontraba nada.

Ahora indexa las diez secciones, normaliza acentos y mayúsculas, y devuelve **resultados que dicen de qué sección vienen**. Resaltar palabras dentro de ocho secciones plegadas sería resaltar cosas que nadie ve.

## 36. La versión impresa es A4 vertical y a una columna

Dos columnas caben más palabras, pero el caso de uso es alguien con un folio en la mano buscando el día de la basura. Control de viudas y huérfanas, ningún encabezado cerrando página, ninguna tarjeta partida, los bloques plegables abiertos en papel y las secciones descartadas eliminadas del flujo para que no dejen hueco.

## 37. Tres hallazgos de seguridad encontrados auditando, no programando

**El parámetro de demostración ampliaba el acceso.** `?fase=staying` sobre una reserva terminada devolvía el código de la puerta y la clave del WiFi, derribando la función insignia del producto. La regla ahora es monotónica: las fechas reales deciden si el código puede servirse y el parámetro **solo puede quitarlo**.

**El endpoint de QR era un generador abierto.** Aceptaba cualquier URL, así que servía para imprimir un QR de phishing con el dominio de Retorika detrás. Ahora solo admite rutas del sitio o cargas `WIFI:`.

**El login no tenía límite de intentos.** Treinta contraseñas seguidas contra una cuenta real, treinta respuestas y ningún bloqueo. Ahora hay diez intentos por diez minutos con **dos llaves**: por dirección y por cuenta, porque paran ataques distintos.

## 38. Los límites viven en memoria, y se dice

Con varias instancias cada una lleva su cuenta, así que el límite efectivo se multiplica por el número de instancias. Sigue siendo la diferencia entre un ataque de diccionario que termina en una hora y uno que tarda un mes. Llevarlo a la base de datos o a Redis es el siguiente paso, no un secreto.

## 39. El modelo de IA es una lista, no un nombre

El modelo que usábamos se retiró el 16 de agosto, a mitad de proyecto, y la traducción se apagó sin un solo error visible. Ahora el nombre es una **cadena de reserva**: el que configures, el recomendado actual y su hermano pequeño. Una retirada cuesta una traducción más lenta, no una función rota.

Solo se reintenta cuando el error es «ese modelo no existe»: un límite de uso fallaría igual con el siguiente nombre y solo duplicaría la espera.

## 40. Los fallos del proveedor se ven

Las llamadas a la IA se hacían sin capturar la excepción. Cuando el proveedor no respondía, la ruta devolvía un 500 vacío, el bucle de publicación lo ignoraba y **la guía se quedaba sin traducir sin ningún error en ninguna parte**. Ese silencio costó tres rondas de diagnóstico.

Ahora cada fallo tiene una frase —saturación, tiempo agotado, respuesta vacía, JSON inválido— y el endpoint informa de qué hizo: `{guide: "ya estaba", notes: 10, pending: 10}`.

## 41. Tres cuentas de demostración y un reinicio de un comando

Las preguntas interesantes sobre este producto se hacen desde tres sillas: una anfitriona en temporada, un anfitrión el primer día y la administración de Retorika. Una sola cuenta enseñaba una respuesta.

`CONFIRM=si npm run db:reset-demo` borra todo y vuelve a sembrar. **Borrado completo y no quirúrgico** a propósito: «borra lo que no estaba antes» acumula excepciones y acaba dejándose media reserva suelta.

## Lo que sigue sin estar, y por qué

**La interfaz del anfitrión sigue solo en español.** Son unas doscientas cadenas y el cliente objetivo de esta primera versión es español. La guía del huésped —lo que ve el cliente final— sí está en cuatro idiomas. Es una decisión tomada, no una tarea pendiente de la que nos hayamos olvidado.

**Sin cobro, sin soporte y sin analítica web**, que es exactamente por lo que el panel de negocio no finge tener métricas de ingresos.

**Sin pruebas unitarias.** Con el plazo dado, el tiempo fue a un guion de humo que comprueba de extremo a extremo lo que no puede fallar —que el código de la puerta no se sirve fuera de su ventana— más bancos de prueba escritos a medida para lo que no se puede verificar compilando: un traductor falso para la cadena de traducción y un renderizado real de las diapositivas del recuerdo. Ambos encontraron fallos que el compilador no veía.
