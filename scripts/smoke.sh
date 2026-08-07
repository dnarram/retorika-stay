#!/usr/bin/env bash
# Guion de humo: levanta la app compilada y comprueba lo que no puede fallar.
# Uso: npm run build && bash scripts/smoke.sh
set -u
PORT=${PORT:-3311}
BASE="http://localhost:$PORT"
J='content-type: application/json'

npx next start -p "$PORT" > /tmp/retorika-smoke.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 8

check() { printf '%-52s %s\n' "$1" "$2"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "── acceso público ──────────────────────────────────────────────"
check "portada"                          "$(code $BASE/)"
check "enlace de muestra del alojamiento" "$(code $BASE/g/k3f9apx2)"
check "enlace de la estancia en curso"    "$(code $BASE/g/r7d3ka92)"

echo "── el código de entrada y el WiFi solo en su ventana ───────────"
check "muestra: código 4718 en el HTML (0)"        "$(curl -s $BASE/g/k3f9apx2 | grep -c 4718)"
check "muestra: clave WiFi en el HTML (0)"         "$(curl -s $BASE/g/k3f9apx2 | grep -c 'tajo-2026-ronda')"
check "estancia en curso: código presente (1)"     "$(curl -s $BASE/g/r7d3ka92 | grep -c 4718)"
check "estancia terminada: código 9042 (0)"        "$(curl -s $BASE/g/mv8ktp41 | grep -c 9042)"
check "estancia terminada: clave WiFi (0)"         "$(curl -s $BASE/g/mv8ktp41 | grep -c 'lavapies-atico-04')"
check "estancia futura con PIN: sin contenido (0)"  "$(curl -s $BASE/g/r5xw81nq | grep -c 4718)"

echo "── idioma y fases ─────────────────────────────────────────────"
check "guía en francés"                  "$(curl -s "$BASE/g/r7d3ka92?lang=fr" | grep -c 'Bienvenue')"
check "fase recuerdo con resumen"        "$(curl -s "$BASE/g/r7d3ka92?fase=memories" | grep -c 'Tu viaje')"

echo "── sesión y autorización ──────────────────────────────────────"
check "PATCH sin sesión (401)"           "$(code -X PATCH $BASE/api/properties/prop_ronda -H "$J" -d '{"name":"x"}')"
check "crear alojamiento sin sesión (401)" "$(code -X POST $BASE/api/properties -H "$J" -d '{"name":"x","city":"y","address":"zzzz","lat":1,"lng":1}')"
check "crear reserva sin sesión (401)"   "$(code -X POST $BASE/api/stays -H "$J" -d '{}')"
check "login clave mala (401)"           "$(code -X POST $BASE/api/auth/login -H "$J" -d '{"email":"belen@retorika.es","password":"malaclave"}')"
check "login correcto (200)"             "$(code -c /tmp/host.txt -X POST $BASE/api/auth/login -H "$J" -d '{"email":"belen@retorika.es","password":"retorika2026"}')"
check "portada con sesión redirige (307)" "$(code -b /tmp/host.txt $BASE/)"
check "PATCH válido (200)"               "$(code -b /tmp/host.txt -X PATCH $BASE/api/properties/prop_ronda -H "$J" -d '{"checkinFrom":"15:00"}')"
check "PATCH lat=999 (422)"              "$(code -b /tmp/host.txt -X PATCH $BASE/api/properties/prop_ronda -H "$J" -d '{"lat":999}')"
check "registro con clave corta (422)"   "$(code -X POST $BASE/api/auth/register -H "$J" -d '{"name":"Ana","email":"a@b.es","password":"corta"}')"
check "registro correo repetido (409)"   "$(code -X POST $BASE/api/auth/register -H "$J" -d '{"name":"Ana","email":"belen@retorika.es","password":"clavelarga1"}')"
check "reserva con salida anterior (422)" "$(code -b /tmp/host.txt -X POST $BASE/api/stays -H "$J" -d '{"propertyId":"prop_ronda","stay":{"guestName":"X","arrival":"2026-09-10","departure":"2026-09-01","accessCodeOverride":null,"pin":null}}')"

echo "── escritura completa (ejercita el camino de PostgreSQL) ──────"
NEW=$(curl -s -b /tmp/host.txt -X POST $BASE/api/properties -H "$J" \
  -d '{"name":"Piso de prueba","city":"Ronda","address":"Calle Falsa 1","lat":36.74,"lng":-5.16}')
PID=$(echo "$NEW" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
check "crear alojamiento"                "$([ -n "$PID" ] && echo ok || echo FALLO)"
check "PATCH con contactos (jsonb)"      "$(code -b /tmp/host.txt -X PATCH $BASE/api/properties/$PID -H "$J" -d '{"contacts":[{"kind":"emergency","phone":"112"},{"kind":"taxi","phone":"+34952872316"}],"accessCode":"1234"}')"
STAY=$(curl -s -b /tmp/host.txt -X POST $BASE/api/stays -H "$J" \
  -d "{\"propertyId\":\"$PID\",\"stay\":{\"guestName\":\"Prueba\",\"arrival\":\"2026-09-01\",\"departure\":\"2026-09-05\",\"accessCodeOverride\":null,\"pin\":null}}")
SID=$(echo "$STAY" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
check "crear reserva"                    "$([ -n "$SID" ] && echo ok || echo FALLO)"
check "borrar reserva"                   "$(code -b /tmp/host.txt -X DELETE $BASE/api/stays/$SID)"
check "borrar alojamiento en cascada"    "$(code -b /tmp/host.txt -X DELETE $BASE/api/properties/$PID)"
check "el alojamiento borrado ya no está (404)" "$(code $BASE/g/$PID)"

echo "── servicios ──────────────────────────────────────────────────"
check "asistente sin clave (501)"        "$(code -b /tmp/host.txt -X POST $BASE/api/assist -H "$J" -d '{"task":"pasos","input":"caja de llaves gris"}')"
check "traducir sin clave (501)"         "$(code -b /tmp/host.txt -X POST $BASE/api/translate -H "$J" -d '{"propertyId":"prop_ronda","from":"es","to":"fr"}')"
check "métrica anónima (204)"            "$(code -X POST $BASE/api/track -H "$J" -d '{"slug":"k3f9apx2","kind":"open","value":""}')"
check "métrica con tipo inventado (400)" "$(code -X POST $BASE/api/track -H "$J" -d '{"slug":"k3f9apx2","kind":"spy","value":""}')"
check "cabecera noindex"                 "$(curl -sI $BASE/g/k3f9apx2 | grep -ci 'x-robots-tag')"

printf '%-52s ' "límite de intentos del PIN"
for _ in 1 2 3 4 5 6; do code -X POST $BASE/api/guide/k3f9apx2/unlock -H "$J" -d '{"pin":"0000"}'; printf ' '; done
echo
