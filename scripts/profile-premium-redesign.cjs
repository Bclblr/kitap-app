const fs = require('fs');

const path = 'src/app/profile.tsx';
let s = fs.readFileSync(path, 'utf8');

const replacements = [
  ["backgroundColor: '#F7F7F5',", "backgroundColor: '#090A0F',"],
  ["color: '#777',", "color: '#8E8E98',"],
  ["fontSize: 30,\n    fontWeight: '700',\n    color: '#222',", "fontSize: 18,\n    fontWeight: '700',\n    color: '#F5F5F7',"],
  ["height: 190,", "height: 210,"],
  ["backgroundColor: '#DDD9D0',", "backgroundColor: '#14151C',"],
  ["color: '#666',", "color: '#8E8E98',"],
  ["backgroundColor: '#222',\n    justifyContent: 'center',\n    alignItems: 'center',", "backgroundColor: '#24252E',\n    justifyContent: 'center',\n    alignItems: 'center',"],
  ["borderColor: '#F7F7F5',", "borderColor: '#090A0F',"],
  ["backgroundColor: '#E5E5E0',", "backgroundColor: '#1A1B23',"],
  ["fontSize: 23,\n    fontWeight: '700',\n    color: '#222',", "fontSize: 26,\n    fontWeight: '800',\n    color: '#F7F7FA',"],
  ["textAlign: 'center',\n    color: '#777',", "textAlign: 'center',\n    color: '#A2A2AC',"],
  ["backgroundColor: '#FFF',\n    borderRadius: 12,\n    borderWidth: 1,\n    borderColor: '#E2E2E2',", "backgroundColor: '#15161D',\n    borderRadius: 12,\n    borderWidth: 1,\n    borderColor: '#292A34',"],
  ["fontSize: 15,\n    color: '#222',", "fontSize: 15,\n    color: '#F5F5F7',"],
  ["backgroundColor: '#E8E8E3',", "backgroundColor: '#20212A',"],
  ["color: '#555',", "color: '#B0B0BA',"],
  ["backgroundColor: '#222',\n    alignSelf: 'center',", "backgroundColor: '#5B4BC4',\n    alignSelf: 'center',"],
  ["backgroundColor: '#222',\n    alignSelf: 'center',", "backgroundColor: '#5B4BC4',\n    alignSelf: 'center',"],
  ["backgroundColor: '#FFF',\n    borderRadius: 18,", "backgroundColor: '#111218',\n    borderRadius: 18,\n    borderWidth: 1,\n    borderColor: '#22232C',"],
  ["fontSize: 19,\n    fontWeight: '700',\n    color: '#222',", "fontSize: 19,\n    fontWeight: '800',\n    color: '#F7F7FA',"],
  ["fontSize: 11,\n    color: '#777',", "fontSize: 11,\n    color: '#8E8E98',"],
  ["fontSize: 21,\n    fontWeight: '700',\n    color: '#222',", "fontSize: 19,\n    fontWeight: '800',\n    color: '#F7F7FA',"],
  ["backgroundColor: '#FFF',\n    borderRadius: 18,\n    padding: 25,", "backgroundColor: '#111218',\n    borderRadius: 18,\n    padding: 25,\n    borderWidth: 1,\n    borderColor: '#22232C',"],
  ["backgroundColor: '#FFF',\n    borderRadius: 18,\n    padding: 18,", "backgroundColor: '#111218',\n    borderRadius: 18,\n    padding: 18,\n    borderWidth: 1,\n    borderColor: '#22232C',"],
  ["borderLeftColor: '#444',", "borderLeftColor: '#7C63E6',"],
  ["color: '#444',", "color: '#D4D4DA',"],
  ["color: '#333',", "color: '#E7E7EB',"],
  ["backgroundColor: '#F2F2EE',", "backgroundColor: '#181920',"],
  ["borderTopColor: '#EEE',", "borderTopColor: '#25262F',"],
  ["backgroundColor: '#F0F0EC',", "backgroundColor: '#1B1C24',"],
  ["borderBottomColor: '#EEE',", "borderBottomColor: '#25262F',"],
];

for (const [from, to] of replacements) s = s.split(from).join(to);

// Profil aksiyonlarını referanstaki mor + koyu ikili buton görünümüne yaklaştır.
s = s.replace(/profileActions: \{[\s\S]*?\n\},\n\nmessageButton:/, `profileActions: {\n    flexDirection: 'row',\n    gap: 10,\n    marginTop: 16,\n    marginHorizontal: 20,\n  },\n\nmessageButton:`);
s = s.replace(/messageButton: \{[\s\S]*?\n\},\n\nmessageButtonText:/, `messageButton: {\n    flex: 1,\n    minHeight: 46,\n    borderRadius: 23,\n    backgroundColor: '#1B1C23',\n    borderWidth: 1,\n    borderColor: '#292A34',\n    justifyContent: 'center',\n    alignItems: 'center',\n    paddingHorizontal: 12,\n  },\n\nmessageButtonText:`);
s = s.replace(/followButton: \{[\s\S]*?\n  \},\n\n  followingButton:/, `followButton: {\n    flex: 1,\n    minHeight: 46,\n    marginTop: 0,\n    paddingHorizontal: 18,\n    borderRadius: 23,\n    backgroundColor: '#5B4BC4',\n    alignSelf: 'stretch',\n    justifyContent: 'center',\n    alignItems: 'center',\n  },\n\n  followingButton:`);
s = s.replace(/followingButton: \{[\s\S]*?\n  \},\n\n  followButtonText:/, `followingButton: {\n    backgroundColor: '#4D3FB0',\n  },\n\n  followButtonText:`);
s = s.replace(/editButton: \{[\s\S]*?\n  \},\n\n  editButtonText:/, `editButton: {\n    marginTop: 18,\n    marginHorizontal: 20,\n    minHeight: 46,\n    borderRadius: 23,\n    backgroundColor: '#5B4BC4',\n    alignSelf: 'stretch',\n    justifyContent: 'center',\n    alignItems: 'center',\n  },\n\n  editButtonText:`);
s = s.replace(/stats: \{[\s\S]*?\n  \},\n\n  stat:/, `stats: {\n    flexDirection: 'row',\n    marginTop: 22,\n    marginHorizontal: 16,\n    justifyContent: 'space-around',\n    paddingVertical: 18,\n    backgroundColor: '#111218',\n    borderRadius: 16,\n    borderWidth: 1,\n    borderColor: '#22232C',\n  },\n\n  stat:`);

fs.writeFileSync(path, s, 'utf8');
console.log('Profil premium koyu tasarıma dönüştürüldü.');
