const fs = require('fs');

const path = 'src/app/chat.tsx';
let source = fs.readFileSync(path, 'utf8');

if (source.includes(".limit(100)\n            .then")) {
  console.log('Chat optimization already applied.');
  process.exit(0);
}

source = source.replace(
`      async (\n        activeConversationId: string\n      ) => {\n        const { data, error } =\n          await supabase\n            .from('messages')\n            .select(\n  'id, conversation_id, sender_id, content, created_at, is_read'\n)\n            .eq(\n              'conversation_id',\n              activeConversationId\n            )\n            .order(\n              'created_at',\n              {\n                ascending: true,\n              }\n            );`,
`      async (\n        activeConversationId: string,\n        viewerId: string\n      ) => {\n        const { data, error } =\n          await supabase\n            .from('messages')\n            .select(\n              'id, conversation_id, sender_id, content, created_at, is_read'\n            )\n            .eq(\n              'conversation_id',\n              activeConversationId\n            )\n            .order('created_at', { ascending: false })\n            .limit(100);`
);

source = source.replace(
`        if (currentUserId) {\n  const { error: readError } = await supabase\n    .from('messages')\n    .update({\n      is_read: true,\n    })\n    .eq(\n      'conversation_id',\n      activeConversationId\n    )\n    .neq(\n      'sender_id',\n      currentUserId\n    )\n    .eq(\n      'is_read',\n      false\n    );\n\n  if (readError) {\n    console.error(\n      'Mesajlar okundu olarak işaretlenemedi:',\n      readError\n    );\n  }\n}\n\n        setMessages(\n          (data as Message[]) || []\n        );\n      },\n      [currentUserId]\n    );`,
`        const { error: readError } = await supabase\n          .from('messages')\n          .update({ is_read: true })\n          .eq('conversation_id', activeConversationId)\n          .neq('sender_id', viewerId)\n          .eq('is_read', false);\n\n        if (readError) {\n          console.error('Mesajlar okundu olarak işaretlenemedi:', readError);\n        }\n\n        const ordered = ((data as Message[]) || []).slice().reverse();\n        setMessages(ordered);\n      },\n      []\n    );`
);

source = source.replace(
`          await loadMessages(\n            conversationIdParam\n          );`,
`          await loadMessages(\n            conversationIdParam,\n            user.id\n          );`
);

source = source.replace(
`        await loadMessages(id);`,
`        await loadMessages(id, user.id);`
);

source = source.replace(
`          .select(\n            'id, conversation_id, sender_id, content, created_at'\n          )`,
`          .select(\n            'id, conversation_id, sender_id, content, created_at, is_read'\n          )`
);

source = source.replace(
`          showsVerticalScrollIndicator={\n            false\n        }`,
`          showsVerticalScrollIndicator={false}\n          initialNumToRender={24}\n          maxToRenderPerBatch={24}\n          windowSize={9}`
);

if (!source.includes('.limit(100);')) throw new Error('Message pagination patch failed');
if (!source.includes('loadMessages(id, user.id);')) throw new Error('Viewer-aware read patch failed');

fs.writeFileSync(path, source);
console.log('Chat optimization applied.');
