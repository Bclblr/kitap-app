from pathlib import Path

p = Path('src/app/profile-settings.tsx')
s = p.read_text()

anchor = """        {canOpenAdmin ? (\n          <Pressable onPress={() => router.push('/admin')} style={styles.adminButton}>"""
addition = """        <Pressable onPress={() => router.push('/blocked-users')} style={styles.adminButton}>\n          <Text style={styles.adminButtonText}>🚫 Engellenen Kullanıcılar</Text>\n          <Text style={styles.adminButtonArrow}>›</Text>\n        </Pressable>\n\n"""

if "router.push('/blocked-users')" not in s:
    if anchor not in s:
        raise SystemExit('blocked users link anchor missing')
    s = s.replace(anchor, addition + anchor, 1)

p.write_text(s)
