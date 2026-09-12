const fs = require('fs');

const file = 'src/components/app-tabs.tsx';
let text = fs.readFileSync(file, 'utf8');

text = text.replace(
`import {
  Icon,
  Label,
  NativeTabs,
} from 'expo-router/unstable-native-tabs';`,
`import { NativeTabs } from 'expo-router/unstable-native-tabs';`
);

text = text.replaceAll('<Label>', '<NativeTabs.Trigger.Label>');
text = text.replaceAll('</Label>', '</NativeTabs.Trigger.Label>');

text = text.replace(
`<Icon
          src={require('@/assets/images/tabIcons/home.png')}
        />`,
`<NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
        />`
);

text = text.replace(
`<Icon
          src={require('@/assets/images/tabIcons/explore.png')}
        />`,
`<NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
        />`
);

fs.writeFileSync(file, text, 'utf8');

console.log('TAMAM: app-tabs.tsx Expo SDK 57 NativeTabs API ile güncellendi.');
