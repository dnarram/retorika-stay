#!/usr/bin/env bash
# Guion de humo: levanta la app compilada y comprueba lo que no puede fallar.
# Uso: npm run build && bash scripts/smoke.sh
set -u
PORT=${PORT:-3311}
BASE="http://localhost:$PORT"

npx next start -p "$PORT" > /tmp/retorika-smoke.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 8

check() { printf '%-46s %s\n' "$1" "$2"; }

check "home"                      "$(curl -s -o /dev/null -w '%{http_code}' $BASE/)"
check "guia publica"              "$(curl -s -o /dev/null -w '%{http_code}' $BASE/g/k3f9apx2)"
check "codigo de acceso si fase=antes (0)"  "$(curl -s "$BASE/g/k3f9apx2?fase=antes" | grep -c 4718)"
check "guia en frances"           "$(curl -s "$BASE/g/k3f9apx2?lang=fr" | grep -c 'Bienvenue')"
check "PIN incorrecto (401)"      "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/guide/m7q2ldv5/unlock -H 'content-type: application/json' -d '{"pin":"1111"}')"
check "PIN correcto (200)"        "$(curl -s -c /tmp/pin.txt -o /dev/null -w '%{http_code}' -X POST $BASE/api/guide/m7q2ldv5/unlock -H 'content-type: application/json' -d '{"pin":"2610"}')"
check "PATCH sin sesion (401)"    "$(curl -s -o /dev/null -w '%{http_code}' -X PATCH $BASE/api/properties/prop_ronda -H 'content-type: application/json' -d '{"name":"x"}')"
check "login clave mala (401)"    "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/auth/login -H 'content-type: application/json' -d '{"email":"belen@retorika.es","password":"malaclave"}')"
check "login correcto (200)"      "$(curl -s -c /tmp/host.txt -o /dev/null -w '%{http_code}' -X POST $BASE/api/auth/login -H 'content-type: application/json' -d '{"email":"belen@retorika.es","password":"retorika2026"}')"
check "PATCH valido (200)"        "$(curl -s -b /tmp/host.txt -o /dev/null -w '%{http_code}' -X PATCH $BASE/api/properties/prop_ronda -H 'content-type: application/json' -d '{"checkinFrom":"15:00"}')"
check "PATCH lat=999 (422)"       "$(curl -s -b /tmp/host.txt -o /dev/null -w '%{http_code}' -X PATCH $BASE/api/properties/prop_ronda -H 'content-type: application/json' -d '{"lat":999}')"
check "traducir sin clave (501)"  "$(curl -s -b /tmp/host.txt -o /dev/null -w '%{http_code}' -X POST $BASE/api/translate -H 'content-type: application/json' -d '{"propertyId":"prop_ronda","from":"es","to":"fr"}')"
check "cabecera noindex"          "$(curl -sI $BASE/g/k3f9apx2 | grep -ci 'x-robots-tag')"
printf '%-46s ' "limite de intentos del PIN"
for _ in 1 2 3 4 5 6; do curl -s -o /dev/null -w '%{http_code} ' -X POST $BASE/api/guide/k3f9apx2/unlock -H 'content-type: application/json' -d '{"pin":"0000"}'; done
echo
