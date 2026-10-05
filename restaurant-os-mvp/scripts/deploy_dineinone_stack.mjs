import fs from 'fs';
import { spawn } from 'child_process';

const creds = JSON.parse(fs.readFileSync('scripts/dineinone_credentials.json', 'utf8'));

// 1. Generate .env
const envContent = `############
# Secrets for Dine in One
############

POSTGRES_PASSWORD=${creds.postgresPassword}
JWT_SECRET=${creds.jwtSecret}
ANON_KEY=${creds.anonKey}
SERVICE_ROLE_KEY=${creds.serviceRoleKey}
DASHBOARD_USERNAME=dineinone
DASHBOARD_PASSWORD=${creds.dashboardPassword}
SECRET_KEY_BASE=${creds.secretKeyBase}
VAULT_ENC_KEY=${creds.vaultEncKey}
PG_META_CRYPTO_KEY=${creds.pgMetaCryptoKey}

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
LOGFLARE_PUBLIC_ACCESS_TOKEN=${creds.logflarePublicToken}
LOGFLARE_PRIVATE_ACCESS_TOKEN=${creds.logflarePrivateToken}
DOCKER_SOCKET_LOCATION=/var/run/docker.sock
GOOGLE_PROJECT_ID=GOOGLE_PROJECT_ID
GOOGLE_PROJECT_NUMBER=GOOGLE_PROJECT_NUMBER
`;
fs.writeFileSync('scripts/dineinone_env', envContent);

// 2. Generate docker-compose.yml
let compose = fs.readFileSync('scripts/vps_original_compose.yml', 'utf8');
compose = compose.replace(/name:\s*supabase/, 'name: supabase-dineinone');
compose = compose.replace('container_name: supabase-studio', 'container_name: dineinone-studio');
compose = compose.replace('container_name: supabase-kong', 'container_name: dineinone-kong');
compose = compose.replace('container_name: supabase-auth', 'container_name: dineinone-auth');
compose = compose.replace('container_name: supabase-rest', 'container_name: dineinone-rest');
compose = compose.replace('container_name: realtime-dev.supabase-realtime', 'container_name: realtime-dev.dineinone-realtime');
compose = compose.replace('container_name: supabase-storage', 'container_name: dineinone-storage');
compose = compose.replace('container_name: supabase-imgproxy', 'container_name: dineinone-imgproxy');
compose = compose.replace('container_name: supabase-meta', 'container_name: dineinone-meta');
compose = compose.replace('container_name: supabase-edge-functions', 'container_name: dineinone-edge-functions');
compose = compose.replace('container_name: supabase-analytics', 'container_name: dineinone-analytics');
compose = compose.replace('container_name: supabase-db', 'container_name: dineinone-db');
compose = compose.replace('container_name: supabase-vector', 'container_name: dineinone-vector');
compose = compose.replace('container_name: supabase-pooler', 'container_name: dineinone-pooler');

// Ports
compose = compose.replace('"4444:3000"', '"4445:3000"');
compose = compose.replace('4000:4000', '4001:4000');
compose = compose.replace('- ${POSTGRES_PORT}:5432', '- 5433:5432');
compose = compose.replace('- ${POOLER_PROXY_PORT_TRANSACTION}:6543', '- 6544:6543');

fs.writeFileSync('scripts/dineinone_docker_compose.yml', compose);

// 3. Generate kong.yml
let kong = fs.readFileSync('scripts/vps_original_kong.yml', 'utf8');
kong = kong.replaceAll('realtime-dev.supabase-realtime', 'realtime-dev.dineinone-realtime');
fs.writeFileSync('scripts/dineinone_kong.yml', kong);

// 4. Generate vector.yml
let vector = fs.readFileSync('scripts/vps_original_vector.yml', 'utf8');
vector = vector.replaceAll('supabase-vector', 'dineinone-vector');
vector = vector.replaceAll('supabase-kong', 'dineinone-kong');
vector = vector.replaceAll('supabase-auth', 'dineinone-auth');
vector = vector.replaceAll('supabase-rest', 'dineinone-rest');
vector = vector.replaceAll('realtime-dev.supabase-realtime', 'realtime-dev.dineinone-realtime');
vector = vector.replaceAll('supabase-storage', 'dineinone-storage');
vector = vector.replaceAll('supabase-edge-functions', 'dineinone-edge-functions');
vector = vector.replaceAll('supabase-db', 'dineinone-db');
fs.writeFileSync('scripts/dineinone_vector.yml', vector);

console.log("All local configuration files successfully prepared.");

// Helper function to upload file via base64
function uploadFile(localPath, remotePath) {
  const content = fs.readFileSync(localPath, 'base64');
  return new Promise((resolve, reject) => {
    const script = `
set timeout 60
spawn ssh -o StrictHostKeyChecking=no root@72.61.250.231 "echo ${content} | base64 -d > ${remotePath}"
expect {
    "*assword:*" {
        send "Karthiktraders@12\\r"
        exp_continue
    }
    eof
}
catch wait result
set exit_status [lindex $result 3]
exit $exit_status
`;
    const proc = spawn('expect', ['-c', script], { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed uploading ${localPath} -> ${remotePath} (code ${code})`));
    });
  });
}

function runRemote(cmd) {
  return new Promise((resolve, reject) => {
    const script = `
set timeout 180
spawn ssh -o StrictHostKeyChecking=no root@72.61.250.231 ${JSON.stringify(cmd)}
expect {
    "*assword:*" {
        send "Karthiktraders@12\\r"
        exp_continue
    }
    eof
}
catch wait result
set exit_status [lindex $result 3]
exit $exit_status
`;
    const proc = spawn('expect', ['-c', script], { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed remote cmd: ${cmd} (code ${code})`));
    });
  });
}

async function run() {
  console.log("Uploading files to VPS...");
  await uploadFile('scripts/dineinone_env', '/root/supabase-dineinone/docker/.env');
  console.log("Uploaded .env");
  await uploadFile('scripts/dineinone_docker_compose.yml', '/root/supabase-dineinone/docker/docker-compose.yml');
  console.log("Uploaded docker-compose.yml");
  await uploadFile('scripts/dineinone_kong.yml', '/root/supabase-dineinone/docker/volumes/api/kong.yml');
  console.log("Uploaded kong.yml");
  await uploadFile('scripts/dineinone_vector.yml', '/root/supabase-dineinone/docker/volumes/logs/vector.yml');
  console.log("Uploaded vector.yml");

  console.log("Cleaning fresh DB data folder...");
  await runRemote('rm -rf /root/supabase-dineinone/docker/volumes/db/data && mkdir -p /root/supabase-dineinone/docker/volumes/db/data');

  console.log("Starting docker compose up -d for supabase-dineinone...");
  await runRemote('cd /root/supabase-dineinone/docker && docker compose up -d');

  console.log("Verifying containers status...");
  await runRemote('docker ps --filter name=dineinone --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"');
}

run().catch(console.error);
