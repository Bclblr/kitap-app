const fs = require('fs');
const path = 'src/app/profile.tsx';
let s = fs.readFileSync(path, 'utf8');

const needle = "          {visibleFeed.length === 0 ? (";
if (!s.includes(needle)) {
  throw new Error('Private profile UI patch target not found');
}

const replacement = `          {!canViewProfileContent ? (\n            <View style={styles.emptyCard}>\n              <Text style={styles.emptyIcon}>🔒</Text>\n              <Text style={styles.emptyTitle}>Bu hesap gizli</Text>\n              <Text style={styles.emptyText}>\n                Bu hesabın gönderilerini, incelemelerini, alıntılarını ve tekrar paylaşımlarını görmek için takip isteğinin onaylanması gerekiyor.\n              </Text>\n              {!isOwnProfile && (\n                <Pressable\n                  onPress={toggleFollow}\n                  disabled={followLoading}\n                  style={[styles.followButton, { width: '100%', marginTop: 16 }]}\n                  accessibilityRole=\"button\"\n                  accessibilityLabel={followRequestPending ? 'Takip isteğini iptal et' : 'Takip isteği gönder'}\n                >\n                  <Text style={styles.followButtonText}>\n                    {followLoading ? '...' : followRequestPending ? 'İstek Gönderildi' : 'Takip İsteği Gönder'}\n                  </Text>\n                </Pressable>\n              )}\n            </View>\n          ) : visibleFeed.length === 0 ? (`;

s = s.replace(needle, replacement);
fs.writeFileSync(path, s);
