const fs = require('fs');

const path = 'src/app/chat.tsx';
if (!fs.existsSync(path)) throw new Error('src/app/chat.tsx bulunamadı.');

let source = fs.readFileSync(path, 'utf8');

source = source.replace('placeholderTextColor="#999"', 'placeholderTextColor="#777782"');

const styleStart = source.lastIndexOf('const styles =');
if (styleStart === -1) {
  throw new Error('chat.tsx içindeki styles bölümü bulunamadı.');
}

const newStyles = `const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090D',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 18,
    paddingHorizontal: 14,
    paddingBottom: 13,
    backgroundColor: '#0D0D12',
    borderBottomWidth: 1,
    borderBottomColor: '#202028',
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 7,
    backgroundColor: '#15151C',
    borderWidth: 1,
    borderColor: '#24242D',
  },

  backText: {
    fontSize: 34,
    lineHeight: 36,
    color: '#F1F1F5',
    fontWeight: '300',
  },

  headerAvatar: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: '#1D1728',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#34264B',
  },

  headerAvatarText: {
    fontSize: 20,
  },

  headerInfo: {
    flex: 1,
    marginLeft: 11,
  },

  headerUsername: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F4F4F6',
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#85858F',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 10,
    color: '#8A8A94',
    fontSize: 14,
  },

  messageList: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 18,
  },

  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  emptyContainer: {
    alignItems: 'center',
  },

  emptyIcon: {
    fontSize: 42,
    opacity: 0.8,
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F1F4',
  },

  emptyText: {
    marginTop: 6,
    color: '#85858F',
    fontSize: 14,
  },

  messageRow: {
    width: '100%',
    marginBottom: 9,
  },

  myMessageRow: {
    alignItems: 'flex-end',
  },

  otherMessageRow: {
    alignItems: 'flex-start',
  },

  messageBubble: {
    maxWidth: '79%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },

  myMessageBubble: {
    backgroundColor: '#6F4ED8',
    borderBottomRightRadius: 6,
    borderWidth: 1,
    borderColor: '#8062DD',
  },

  otherMessageBubble: {
    backgroundColor: '#15151B',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#26262F',
  },

  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },

  myMessageText: {
    color: '#FFFFFF',
  },

  otherMessageText: {
    color: '#E7E7EB',
  },

  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },

  messageTime: {
    fontSize: 9,
  },

  myMessageTime: {
    color: '#D9D0F7',
    textAlign: 'right',
  },

  otherMessageTime: {
    color: '#777782',
  },

  readStatus: {
    marginLeft: 4,
    fontSize: 12,
    color: '#D0C7ED',
    fontWeight: '700',
  },

  readStatusRead: {
    color: '#D9CFFF',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#0D0D12',
    borderTopWidth: 1,
    borderTopColor: '#202028',
  },

  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 46,
    backgroundColor: '#15151B',
    borderRadius: 23,
    paddingHorizontal: 17,
    paddingVertical: 11,
    fontSize: 14,
    color: '#F2F2F5',
    borderWidth: 1,
    borderColor: '#292932',
  },

  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#6F4ED8',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#8062DD',
  },

  sendButtonDisabled: {
    opacity: 0.4,
  },

  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
});
`;

source = source.slice(0, styleStart) + newStyles;

fs.writeFileSync(path, source, 'utf8');
console.log('Mesajlaşma sayfası koyu premium tasarıma uyarlandı.');
