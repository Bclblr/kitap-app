const fs = require('fs');

const file = 'app.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

data.expo.ios = data.expo.ios || {};
data.expo.ios.usesAppleSignIn = true;

data.expo.plugins = data.expo.plugins || [];

const hasApplePlugin = data.expo.plugins.some((plugin) =>
  Array.isArray(plugin)
    ? plugin[0] === 'expo-apple-authentication'
    : plugin === 'expo-apple-authentication'
);

if (!hasApplePlugin) {
  data.expo.plugins.push('expo-apple-authentication');
}

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');

console.log('APPLE SIGN IN APP.JSON AYARLANDI');
