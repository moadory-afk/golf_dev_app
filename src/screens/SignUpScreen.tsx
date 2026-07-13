import { useState } from 'react';

import { Alert, Image, KeyboardAvoidingView, Linking, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { ensureProfile } from '../lib/store';
import { nameToAuthEmail } from '../lib/authEmail';
import { C } from '../theme';

const APP_URL = 'https://golf-seven-psi.vercel.app';

export default function SignUpScreen({ navigation }: { navigation: any }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [signupComplete, setSignupComplete] = useState(false);

  const clearError = () => setErrorMsg(null);

  async function shareInstallLink() {
    const message = [
      'GogoPar 앱 설치 및 회원가입 안내',
      '',
      '아래 링크를 열고 홈 화면에 추가해 사용하세요.',
      APP_URL,
    ].join('\n');
    try {
      await Share.share({ title: 'GogoPar 앱 설치 안내', message });
    } catch {
      Alert.alert('공유 실패', message);
    }
  }

  async function handleSignUp() {
    if (!name.trim() || !password) {
      setErrorMsg('이름과 비밀번호를 입력하세요');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('비밀번호는 6자리 이상이어야 합니다');
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
      setSignupComplete(true);
    }
  }

  if (signupComplete) {
    const installSteps = Platform.OS === 'ios'
      ? ['Safari에서 접속', '공유 버튼 선택', '홈 화면에 추가']
      : Platform.OS === 'android'
        ? ['Chrome에서 접속', '메뉴 선택', '앱 설치 또는 홈 화면에 추가']
        : ['모바일 브라우저에서 접속', '브라우저 메뉴 선택', '홈 화면에 추가'];

    return (
      <ScrollView contentContainerStyle={s.scrollContent}>
        <View style={s.header}>
          <Image source={require('../../assets/app-icon-1024.png')} style={s.appIcon} resizeMode="contain" />
          <Text style={s.completeTitle}>회원가입이 완료되었습니다</Text>
          <Text style={s.sub}>홈 화면에 추가하면 앱처럼 사용할 수 있습니다.</Text>
        </View>
        <View style={s.form}>
          <Text style={s.installTitle}>홈 화면에 추가하기</Text>
          {installSteps.map((step, index) => (
            <View key={step} style={s.stepRow}>
              <Text style={s.stepNo}>{index + 1}</Text>
              <Text style={s.stepText}>{step}</Text>
            </View>
          ))}
          <TouchableOpacity style={s.signupBtn} onPress={() => navigation.navigate('Main' as never)} activeOpacity={0.86}>
            <Text style={s.signupBtnText}>앱 시작하기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.shareBtn} onPress={shareInstallLink} activeOpacity={0.86}>
            <Text style={s.shareBtnText}>설치 링크 공유하기</Text>
          </TouchableOpacity>
          {Platform.OS === 'web' ? (
            <TouchableOpacity style={s.linkBtn} onPress={() => Linking.openURL(APP_URL)}>
              <Text style={s.linkBtnText}>설치 페이지 열기</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    );
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
            placeholder="비밀번호 6자리 이상"
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
  completeTitle: { fontSize: 20, fontWeight: '900', color: C.text, marginTop: 4 },
  installTitle: { fontSize: 16, fontWeight: '900', color: C.text, marginBottom: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border },
  stepNo: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.greenLight, color: C.green, fontWeight: '900', textAlign: 'center', textAlignVertical: 'center' },
  stepText: { flex: 1, fontSize: 14, fontWeight: '800', color: C.text },
  shareBtn: { borderWidth: 1.5, borderColor: C.green, borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  shareBtnText: { color: C.green, fontWeight: '800', fontSize: 14 },
  linkBtn: { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  linkBtnText: { color: C.muted, fontWeight: '700', fontSize: 13 },
});
