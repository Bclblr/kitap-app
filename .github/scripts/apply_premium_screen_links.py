from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label} anchor not found")
    return text.replace(old, new, 1)

# Register authenticated Premium route.
p = Path('src/app/_layout.tsx')
t = p.read_text(encoding='utf-8')
t = replace_once(
    t,
    "              'profile-settings',\n              'quote-create',",
    "              'profile-settings',\n              'premium',\n              'quote-create',",
    'premium route',
)
p.write_text(t, encoding='utf-8')

# Add Premium entry to profile settings.
p = Path('src/app/profile-settings.tsx')
t = p.read_text(encoding='utf-8')
anchor = """        <Pressable onPress={() => router.push('/blocked-users')} style={styles.adminButton} disabled={saving}>
          <Text style={styles.adminButtonText}>🚫 Engellenen Kullanıcılar</Text>
          <Text style={styles.adminButtonArrow}>›</Text>
        </Pressable>
"""
replacement = """        <Pressable onPress={() => router.push('/premium')} style={styles.adminButton} disabled={saving}>
          <Text style={styles.adminButtonText}>✦ Kitap Premium</Text>
          <Text style={styles.adminButtonArrow}>›</Text>
        </Pressable>

""" + anchor
t = replace_once(t, anchor, replacement, 'profile premium entry')
p.write_text(t, encoding='utf-8')
