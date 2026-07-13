import { useState } from 'react';

import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { ensureProfile } from '../lib/store';
import { nameToAuthEmail } from '../lib/authEmail';
import { C } from '../theme';

export default function SignUpScreen({ navigation }: { navigation: any }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const clearError = () => setErrorMsg(null);

  async function handleSignUp() {
    if (!name.trim() || !password) {
      setErrorMsg('이름과 비밀번호를 입력하세요');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    const email = nameToAuthEmail(name);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setErrorMsg(`회원가입 실패: ${error.message}`);
      return;
    }
    if (data.user) {
      const { error: insertErr } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          name: name.trim(),
          nickname: name.trim(),
        });
      if (insertErr) {
        setErrorMsg(`프로필 저장 실패: ${insertErr.message}`);
        return;
      }
      try {
        await ensureProfile(data.user.id, name.trim());
      } catch {}
      // Navigate to Home tab (Main stack)
      navigation.navigate('Main' as never);
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Image source={require('../../assets/app-icon-1024.png')} style={s.appIcon} resizeMode="contain" />
          <Text style={s.sub}>골프의 모든 경험을 하나로.</Text>
        </View>
        <View style={s.form}>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={(v) => { setName(v); clearError(); }}
            placeholder="이름 입력"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={[s.input, { marginTop: 12 }]}
            value={password}
            onChangeText={(v) => { setPassword(v); clearError(); }}
            placeholder="비밀번호"
            secureTextEntry
          />
          {errorMsg ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{errorMsg}</Text>
            </View>
          ) : null}
          <TouchableOpacity style={s.signupBtn} onPress={handleSignUp} disabled={loading} activeOpacity={0.86}>
            <Text style={s.signupBtnText}>{loading ? '처리 중...' : '회원가입'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  header: { alignItems: 'center', marginBottom: 18 },
  appIcon: { width: 96, height: 96, marginBottom: 12 },
  sub: { fontSize: 14, color: C.muted, marginTop: 6 },
  form: { backgroundColor: C.card, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 10, fontSize: 14, color: C.text, backgroundColor: C.bg, marginBottom: 4 },
  errorBox: { backgroundColor: '#fff0f0', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#ffcccc' },
  errorText: { fontSize: 13, color: '#c0392b', lineHeight: 18 },
  signupBtn: { backgroundColor: C.green, borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginTop: 16 },
  signupBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
