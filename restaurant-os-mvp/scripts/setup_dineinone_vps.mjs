#!/usr/bin/env node
import crypto from 'crypto';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

function base64url(input) {
  return Buffer.from(input).toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function runRemote(cmd) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['scripts/ssh_vps.mjs', cmd], { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ssh_vps exited with code ${code}`));
    });
  });
}

async function main() {
  console.log("=== Step 1: Generating Cryptographic Secrets ===");
  const postgresPassword = crypto.randomBytes(20).toString('hex');
  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 15 * 365 * 24 * 3600; // 15 years
  
  const anonKey = signJwt({ role: "anon", iss: "supabase", iat, exp }, jwtSecret);
  const serviceRoleKey = signJwt({ role: "service_role", iss: "supabase", iat, exp }, jwtSecret);
  
  const dashboardPassword = crypto.randomBytes(16).toString('hex');
  const secretKeyBase = crypto.randomBytes(32).toString('base64');
  const vaultEncKey = crypto.randomBytes(16).toString('hex');
  const pgMetaCryptoKey = crypto.randomBytes(16).toString('hex');
  const logflarePublicToken = crypto.randomBytes(20).toString('hex');
  const logflarePrivateToken = crypto.randomBytes(20).toString('hex');

  const generatedConfig = {
    postgresPassword,
    jwtSecret,
    anonKey,
    serviceRoleKey,
    dashboardPassword,
    secretKeyBase,
    vaultEncKey,
    pgMetaCryptoKey,
    logflarePublicToken,
    logflarePrivateToken
  };

  fs.writeFileSync('scripts/dineinone_credentials.json', JSON.stringify(generatedConfig, null, 2));
  console.log("Saved credentials to scripts/dineinone_credentials.json");

  console.log("\n=== Step 2: Preparing /root/supabase-dineinone on VPS ===");
  await runRemote(`
    mkdir -p /root/supabase-dineinone
    if [ ! -d /root/supabase-dineinone/docker ]; then
      cp -r /root/supabase/docker /root/supabase-dineinone/
      rm -rf /root/supabase-dineinone/docker/volumes/db/data
      mkdir -p /root/supabase-dineinone/docker/volumes/db/data
      rm -rf /root/supabase-dineinone/docker/volumes/storage/stub
      mkdir -p /root/supabase-dineinone/docker/volumes/storage/stub
      rm -f /root/supabase-dineinone/docker/volumes/snippets/*
      echo "Copied docker templates and cleaned data directories."
    else
      echo "Directory /root/supabase-dineinone/docker already exists."
    fi
  `);

  console.log("\n=== Step 3: Writing .env to VPS ===");
  const envContent = `############
# Secrets for Dine in One
############

POSTGRES_PASSWORD=${postgresPassword}
JWT_SECRET=${jwtSecret}
ANON_KEY=${anonKey}
SERVICE_ROLE_KEY=${serviceRoleKey}
DASHBOARD_USERNAME=dineinone
DASHBOARD_PASSWORD=${dashboardPassword}
SECRET_KEY_BASE=${secretKeyBase}
VAULT_ENC_KEY=${vaultEncKey}
PG_META_CRYPTO_KEY=${pgMetaCryptoKey}

############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############
# Supavisor -- Database pooler
############
POOLER_PROXY_PORT_TRANSACTION=6544
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
POOLER_TENANT_ID=dineinone-tenant
POOLER_DB_POOL_SIZE=5

############
# API Proxy - Kong
############
KONG_HTTP_PORT=8010
KONG_HTTPS_PORT=8453

############
# API - PostgREST
############
PGRST_DB_SCHEMAS=public,storage,graphql_public

############
# Auth - GoTrue
############
SITE_URL=http://localhost:3000
ADDITIONAL_REDIRECT_URLS=
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
API_EXTERNAL_URL=http://72.61.250.231:8010

MAILER_URLPATHS_CONFIRMATION="/auth/v1/verify"
MAILER_URLPATHS_INVITE="/auth/v1/verify"
MAILER_URLPATHS_RECOVERY="/auth/v1/verify"
MAILER_URLPATHS_EMAIL_CHANGE="/auth/v1/verify"

ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
SMTP_ADMIN_EMAIL=admin@example.com
SMTP_HOST=supabase-mail
SMTP_PORT=2500
SMTP_USER=fake_mail_user
SMTP_PASS=fake_mail_password
SMTP_SENDER_NAME=fake_sender
ENABLE_ANONYMOUS_USERS=true

ENABLE_PHONE_SIGNUP=true
ENABLE_PHONE_AUTOCONFIRM=true

############
# Studio
############
STUDIO_DEFAULT_ORGANIZATION=Dine in One
STUDIO_DEFAULT_PROJECT=Dine in One
SUPABASE_PUBLIC_URL=http://72.61.250.231:8010
IMGPROXY_ENABLE_WEBP_DETECTION=true
OPENAI_API_KEY=

############
# Functions
############
FUNCTIONS_VERIFY_JWT=false

############
# Logs - Analytics
############
LOGFLARE_PUBLIC_ACCESS_TOKEN=${logflarePublicToken}
LOGFLARE_PRIVATE_ACCESS_TOKEN=${logflarePrivateToken}
DOCKER_SOCKET_LOCATION=/var/run/docker.sock
GOOGLE_PROJECT_ID=GOOGLE_PROJECT_ID
GOOGLE_PROJECT_NUMBER=GOOGLE_PROJECT_NUMBER
`;

  // Write .env to remote
  const b64Env = Buffer.from(envContent).toString('base64');
  await runRemote(`echo "${b64Env}" | base64 -d > /root/supabase-dineinone/docker/.env`);
  console.log("Successfully wrote /root/supabase-dineinone/docker/.env");

  console.log("\n=== Step 4: Updating docker-compose.yml, kong.yml, and vector.yml ===");
  await runRemote(`
    cd /root/supabase-dineinone/docker
    
    # Update compose project name and container names
    sed -i 's/^name: supabase/name: supabase-dineinone/' docker-compose.yml
    sed -i 's/container_name: supabase-studio/container_name: dineinone-studio/' docker-compose.yml
    sed -i 's/container_name: supabase-kong/container_name: dineinone-kong/' docker-compose.yml
    sed -i 's/container_name: supabase-auth/container_name: dineinone-auth/' docker-compose.yml
    sed -i 's/container_name: supabase-rest/container_name: dineinone-rest/' docker-compose.yml
    sed -i 's/container_name: realtime-dev.supabase-realtime/container_name: realtime-dev.dineinone-realtime/' docker-compose.yml
    sed -i 's/container_name: supabase-storage/container_name: dineinone-storage/' docker-compose.yml
    sed -i 's/container_name: supabase-imgproxy/container_name: dineinone-imgproxy/' docker-compose.yml
    sed -i 's/container_name: supabase-meta/container_name: dineinone-meta/' docker-compose.yml
    sed -i 's/container_name: supabase-edge-functions/container_name: dineinone-edge-functions/' docker-compose.yml
    sed -i 's/container_name: supabase-analytics/container_name: dineinone-analytics/' docker-compose.yml
    sed -i 's/container_name: supabase-db/container_name: dineinone-db/' docker-compose.yml
    sed -i 's/container_name: supabase-vector/container_name: dineinone-vector/' docker-compose.yml
    sed -i 's/container_name: supabase-pooler/container_name: dineinone-pooler/' docker-compose.yml

    # Update port mappings in docker-compose.yml
    sed -i 's/"4444:3000"/"4445:3000"/' docker-compose.yml
    sed -i 's/4000:4000/4001:4000/' docker-compose.yml
    sed -i 's/\${POSTGRES_PORT}:5432/5433:5432/' docker-compose.yml

    # Update kong.yml realtime URLs
    sed -i 's/realtime-dev.supabase-realtime/realtime-dev.dineinone-realtime/g' volumes/api/kong.yml

    # Update vector.yml container matches
    sed -i 's/supabase-vector/dineinone-vector/g' volumes/logs/vector.yml
    sed -i 's/supabase-kong/dineinone-kong/g' volumes/logs/vector.yml
    sed -i 's/supabase-auth/dineinone-auth/g' volumes/logs/vector.yml
    sed -i 's/supabase-rest/dineinone-rest/g' volumes/logs/vector.yml
    sed -i 's/realtime-dev.supabase-realtime/realtime-dev.dineinone-realtime/g' volumes/logs/vector.yml
    sed -i 's/supabase-storage/dineinone-storage/g' volumes/logs/vector.yml
    sed -i 's/supabase-edge-functions/dineinone-edge-functions/g' volumes/logs/vector.yml
    sed -i 's/supabase-db/dineinone-db/g' volumes/logs/vector.yml

    echo "Configuration transformation completed."
  `);

  console.log("\n=== Step 5: Starting the new Docker Compose stack ===");
  await runRemote(`
    cd /root/supabase-dineinone/docker
    docker compose up -d
  `);

  console.log("\n=== Step 6: Verifying container health ===");
  await runRemote(`
    docker ps --filter "name=dineinone" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  `);
}

main().catch(err => {
  console.error("Setup failed:", err);
  process.exit(1);
});
