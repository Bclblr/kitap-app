const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const failures = [];

function read(relative) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) {
    failures.push(`${relative}: dosya bulunamadı.`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

const webhook = read('supabase/functions/revenuecat-webhook/index.ts');
const provider = read('src/providers/PremiumProvider.tsx');
const migration = read('supabase/migrations/202609180004_revenuecat_lifecycle_hardening.sql');

const webhookChecks = [
  ['SUBSCRIPTION_PAUSED erişimi expiration öncesi korunmalı', webhook.includes("type === 'SUBSCRIPTION_PAUSED'")],
  ['Grace period bitiş alanı işlenmeli', webhook.includes('grace_period_expiration_at_ms')],
  ['Refund/CUSTOMER_SUPPORT işlenmeli', webhook.includes('CUSTOMER_SUPPORT')],
  ['TRANSFER olayı işlenmeli', webhook.includes("event.type === 'TRANSFER'")],
  ['SANDBOX / PRODUCTION environment işlenmeli', webhook.includes('validEnvironment')],
  ['Transfer kaynak/hedef kullanıcıları işlenmeli', webhook.includes('transferred_from') && webhook.includes('transferred_to')],
];

const providerChecks = [
  ['Eski async premium isteği yeni kullanıcı stateini ezmemeli', provider.includes('reloadSequenceRef')],
  ['Premium entitlement değişiklikleri Realtime ile izlenmeli', provider.includes("table: 'premium_entitlements'")],
  ['Premium bitiş zamanı açık uygulamada yeniden hesaplanmalı', provider.includes('nextExpirationAt') && provider.includes('setTimeout')],
  ['Kullanıcı değişince eski premium state temizlenmeli', provider.includes('previousUserId !== currentUserId')],
];

const migrationChecks = [
  ['Provider environment veritabanında saklanmalı', migration.includes('provider_environment')],
  ['TRANSFER RPC bulunmalı', migration.includes('process_revenuecat_transfer_event')],
  ['Premium tablo Realtime publication içinde olmalı', migration.includes('supabase_realtime') && migration.includes('premium_entitlements')],
  ['Webhook event environment metadata saklanmalı', migration.includes('revenuecat_webhook_events') && migration.includes('environment')],
];

for (const [label, ok] of [...webhookChecks, ...providerChecks, ...migrationChecks]) {
  if (!ok) failures.push(label);
}

if (failures.length) {
  console.error('Premium lifecycle preflight başarısız:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('Premium lifecycle preflight başarılı.');
console.log('Pause, grace period, refund, transfer, environment ve istemci state senkronu statik olarak doğrulandı.');
