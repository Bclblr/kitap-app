const fs = require('fs');

function patch(path, apply) {
  const before = fs.readFileSync(path, 'utf8');
  const after = apply(before);
  if (before === after) throw new Error(`No changes applied to ${path}`);
  fs.writeFileSync(path, after);
}

patch('src/app/profile-settings.tsx', (source) => {
  const needle = `        <Pressable onPress={() => router.push('/blocked-users')} style={styles.adminButton}>\n          <Text style={styles.adminButtonText}>🚫 Engellenen Kullanıcılar</Text>\n          <Text style={styles.adminButtonArrow}>›</Text>\n        </Pressable>`;
  if (!source.includes(needle)) throw new Error('Profile settings insertion point not found');
  return source.replace(
    needle,
    `${needle}\n\n        <Pressable onPress={() => router.push('/notification-settings')} style={styles.adminButton}>\n          <Text style={styles.adminButtonText}>🔔 Bildirim Ayarları</Text>\n          <Text style={styles.adminButtonArrow}>›</Text>\n        </Pressable>`
  );
});

patch('src/app/notifications.tsx', (source) => {
  const loadNeedle = `      const [interactionResult, adminResult] = await Promise.all([\n        supabase\n          .from('notifications')`;
  if (!source.includes(loadNeedle)) throw new Error('Notifications load block not found');

  source = source.replace(
    loadNeedle,
    `      const preferenceResult = await supabase\n        .from('notification_preferences')\n        .select('likes_enabled, comments_enabled, reposts_enabled, system_enabled')\n        .eq('user_id', user.id)\n        .maybeSingle();\n\n      const preferences = {\n        likes_enabled: preferenceResult.data?.likes_enabled ?? true,\n        comments_enabled: preferenceResult.data?.comments_enabled ?? true,\n        reposts_enabled: preferenceResult.data?.reposts_enabled ?? true,\n        system_enabled: preferenceResult.data?.system_enabled ?? true,\n      };\n\n      const [interactionResult, adminResult] = await Promise.all([\n        supabase\n          .from('notifications')`
  );

  const interactionEnd = `      const interactions: InteractionNotification[] = (interactionResult.data ?? []).map(\n        (notification: any) => ({`;
  if (!source.includes(interactionEnd)) throw new Error('Interaction mapping not found');
  source = source.replace(
    interactionEnd,
    `      const interactions: InteractionNotification[] = (interactionResult.data ?? [])\n        .filter((notification: any) => {\n          if (notification.type === 'like') return preferences.likes_enabled;\n          if (notification.type === 'comment') return preferences.comments_enabled;\n          if (notification.type === 'repost') return preferences.reposts_enabled;\n          return true;\n        })\n        .map((notification: any) => ({`
  );

  const adminMap = `      const adminNotifications: AdminNotification[] = (adminResult.data ?? []).map(\n        (notification: any) => ({`;
  if (!source.includes(adminMap)) throw new Error('Admin mapping not found');
  source = source.replace(
    adminMap,
    `      const adminNotifications: AdminNotification[] = preferences.system_enabled\n        ? (adminResult.data ?? []).map(\n        (notification: any) => ({`
  );

  const adminClose = `          read: notification.read === true,\n        })\n      );`;
  if (!source.includes(adminClose)) throw new Error('Admin mapping close not found');
  source = source.replace(
    adminClose,
    `          read: notification.read === true,\n        })\n      )\n        : [];`
  );

  return source;
});

console.log('Notification settings integration applied.');
