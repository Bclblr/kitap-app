const fs = require('fs');

const file = 'app.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

data.expo.ios = data.expo.ios || {};
data.expo.ios.bundleIdentifier = 'com.burukancelebiler.kitapapp';

fs.writeFileSync(
  file,
  JSON.stringify(data, null, 2) + '\n',
  'utf8'
);

console.log(
  'IOS BUNDLE ID:',
  data.expo.ios.bundleIdentifier
);
