import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { createSessionFromUrl } from '@/lib/google-auth';
export default function AuthCallback() {
  const { session } = useAuth(); const { colors } = useAppTheme(); const url = Linking.useURL();
  const [finished,setFinished]=useState(false);
  useEffect(()=>{let alive=true; WebBrowser.maybeCompleteAuthSession();
    if (!url) { const timer = setTimeout(() => { if (alive) setFinished(true); }, 5000); return () => { alive=false; clearTimeout(timer); }; }
    if (!url.includes('access_token=')) return;
    void createSessionFromUrl(url).catch(()=>{}).finally(()=>{if(alive)setFinished(true);});
    return ()=>{alive=false;};
  },[url]);
  if(session) return <Redirect href="/" />;
  if(finished || (url && !url.includes('access_token='))) return <Redirect href="/login" />;
  return <View style={{flex:1,backgroundColor:colors.background,justifyContent:'center',alignItems:'center',gap:12}}><ActivityIndicator color={colors.primary}/><Text style={{color:colors.text}}>Giriş tamamlanıyor…</Text></View>;
}
