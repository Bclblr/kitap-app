import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { ThemeMode } from '@/theme/palette';
export default function ThemePicker() {
  const { colors, mode, setMode } = useAppTheme(); const [error,setError]=useState('');
  return <View style={{gap:8,paddingVertical:16}}><Text style={{color:colors.text,fontSize:16,fontWeight:'700'}}>Ekran Görünümü</Text>
    {([['system','Sistem ayarını kullan'],['light','Açık mod'],['dark','Koyu mod']] as [ThemeMode,string][]).map(([value,label])=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:mode===value}} onPress={()=>{setError('');void setMode(value).catch(()=>setError('Seçim cihazına kaydedilemedi.'));}} style={{minHeight:44,flexDirection:'row',alignItems:'center',gap:10}}><Text style={{color:colors.primary,fontSize:20}}>{mode===value?'◉':'○'}</Text><Text style={{color:colors.text,flexShrink:1}}>{label}</Text></Pressable>)}
    {!!error&&<Text style={{color:colors.danger}}>{error}</Text>}
  </View>;
}
