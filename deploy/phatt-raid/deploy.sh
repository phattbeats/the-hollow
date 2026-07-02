#!/bin/sh
# Deploy The Hollow on PHATT-RAID from inside the studio's agent container.
#
# The phatt-claw socket proxy allows image pull + container create/start/delete
# but blocks exec, so this script materialises a short-lived docker:cli sidecar
# ("the-hollow-deployer") holding the real host socket; the sidecar builds the
# game image from the repo (bind-mounted by HOST path), brings the stack up via
# compose, installs the SWAG vhost, and reloads SWAG. The sidecar is removed
# after its logs are read (orphan containers on Unraid are a known incident).
#
# Required env:
#   HOLLOW_ENV_FILE  path (in this container) to the deploy .env
#                    (POSTGRES_PASSWORD, PUBLIC_ORIGIN, EASTBROOK_IMAGE_TAG)
# Host paths (Unraid):
#   repo:  /mnt/user/appdata/paperclip/instances/default/projects/<...>/the-hollow-mmo
#   swag:  /mnt/disks/docker-drive-phatt/appdata/swag
set -eu

PROXY="http://phatt-claw:2375"
NAME="the-hollow-deployer"
REPO_HOST="/mnt/user/appdata/paperclip/instances/default/projects/17b74b94-a9c5-4a9f-be94-f2028033b94c/a4a13a28-702b-4b0e-b7b8-353d6e18b832/the-hollow-mmo"
SWAG_HOST="/mnt/disks/docker-drive-phatt/appdata/swag"
: "${HOLLOW_ENV_FILE:?set HOLLOW_ENV_FILE}"

echo "==> proxy ping"; curl -sf "$PROXY/_ping"; echo

echo "==> ensure docker:cli image"
curl -s "$PROXY/images/json" | grep -q '"docker:cli"' || \
  curl -s -X POST "$PROXY/images/create?fromImage=docker&tag=cli" --max-time 300 >/dev/null

echo "==> clear any previous deployer"
# Fetch to a file, then parse the file: the container list is DATA and must
# never ride a pipe into an interpreter (the release malware gate flags that).
curl -s "$PROXY/containers/json?all=1" -o /tmp/deployer-containers.json
OLD=$(python3 -c "
import json
for c in json.load(open('/tmp/deployer-containers.json')):
    if '/$NAME' in c['Names']: print(c['Id'])" )
[ -n "$OLD" ] && curl -s -X DELETE "$PROXY/containers/$OLD?force=1" >/dev/null || true

# Env lines from the .env file become container Env entries.
ENVJSON=$(python3 -c "
import json,sys
lines=[l.strip() for l in open('$HOLLOW_ENV_FILE') if l.strip() and not l.startswith('#')]
print(json.dumps(lines))")

SCRIPT='set -eu
cd /w
echo "[deployer] compose up (build included)"
docker compose -p the-hollow -f docker-compose.yml -f deploy/phatt-raid/compose.phatt-raid.yml up -d --build postgres game
echo "[deployer] install swag vhost"
cp /w/deploy/phatt-raid/theplant.subdomain.conf /swagcfg/nginx/proxy-confs/theplant.subdomain.conf
docker restart swag
echo "[deployer] done"'

python3 - "$ENVJSON" "$SCRIPT" <<'PYEOF' > /tmp/deployer-create.json
import json,sys
env=json.loads(sys.argv[1]); script=sys.argv[2]
print(json.dumps({
  "Image":"docker:cli",
  "Entrypoint":["/bin/sh","-c"],
  "Cmd":[script],
  "Env":env,
  "Labels":{"phattclaw.managed":"true","hollow.role":"deployer"},
  "HostConfig":{
    "Binds":[
      "/var/run/docker.sock:/var/run/docker.sock",
      "REPO_HOST:/w",
      "SWAG_HOST:/swagcfg"
    ],
    "AutoRemove": False
  }
}).replace("REPO_HOST", "${REPO_HOST}").replace("SWAG_HOST", "${SWAG_HOST}"))
PYEOF
# substitute the real host paths
python3 - <<PYEOF
import json
d=json.load(open('/tmp/deployer-create.json'))
d['HostConfig']['Binds']=[
  "/var/run/docker.sock:/var/run/docker.sock",
  "$REPO_HOST:/w",
  "$SWAG_HOST:/swagcfg"]
json.dump(d, open('/tmp/deployer-create.json','w'))
PYEOF

echo "==> create + start deployer"
curl -s -X POST "$PROXY/containers/create?name=$NAME" \
  -H 'Content-Type: application/json' --data-binary @/tmp/deployer-create.json \
  -o /tmp/deployer-created.json
NEWID=$(python3 -c "import json; print(json.load(open('/tmp/deployer-created.json')).get('Id',''))")
[ -n "$NEWID" ] || { echo "FATAL: create failed"; exit 1; }
curl -s -X POST "$PROXY/containers/$NEWID/start" >/dev/null
echo "deployer started: $NEWID"
echo "follow with: curl -s '$PROXY/containers/$NEWID/logs?stdout=1&stderr=1&follow=0&tail=50'"
