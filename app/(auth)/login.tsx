import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { authApi } from '../../src/services/authApi';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';
import { safeBack } from '../../src/utils/nav';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithEmail, loginWithEmailCode, status, error, clearError } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);

  const isLoading = status === 'loading';
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    return () => { clearError(); };
  }, []);

  useEffect(() => {
    if (!countdown) return undefined;
    const timer = setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleLogin = useCallback(async () => {
    if (isLoading) return;
    setLocalError('');
    clearError();

    const identifier = username.trim();
    if (!identifier) { setLocalError('请输入用户名或邮箱'); return; }
    if (mode === 'code') {
      if (!code) { setLocalError('请输入邮箱验证码'); return; }
      if (!/^\d{6}$/.test(code)) { setLocalError('验证码为6位数字'); return; }
      if (!identifier.includes('@')) { setLocalError('验证码登录需要使用邮箱'); return; }
      await loginWithEmailCode(identifier, code);
      return;
    }
    if (!password) { setLocalError('请输入密码'); return; }

    if (identifier.includes('@')) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
        setLocalError('邮箱格式不正确');
        return;
      }
      await loginWithEmail(identifier, password);
      return;
    }
    await login(identifier, password);
  }, [username, password, code, mode, isLoading, login, loginWithEmail, loginWithEmailCode, clearError]);

  const handleSendCode = useCallback(async () => {
    const identifier = username.trim().toLowerCase();
    setLocalError('');
    clearError();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      setLocalError('请输入正确的邮箱');
      return;
    }
    if (countdown > 0) return;
    try {
      const result = await authApi.sendEmailLoginCode(identifier);
      setCountdown(Math.max(1, Math.floor(result.expiresIn > 60 ? 60 : result.expiresIn)));
    } catch (requestError: any) {
      setLocalError(requestError.message || '验证码发送失败');
    }
  }, [username, countdown, clearError]);

  const displayError = localError || error;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={safeBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.logoSection}>
            <View style={styles.logoIcon}>
              <Ionicons name="paw" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.appName}>萌宠星球</Text>
            <Text style={styles.welcomeText}>欢迎回来</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput
                testID="login-username-input"
                style={styles.input}
                placeholder="用户名或邮箱"
                placeholderTextColor={Colors.textLight}
                value={username}
                onChangeText={(t) => { setUsername(t); setLocalError(''); clearError(); }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput
                testID="login-password-input"
                ref={passwordRef}
                style={styles.input}
                placeholder={mode === 'password' ? '请输入密码' : '邮箱验证码（6位）'}
                placeholderTextColor={Colors.textLight}
                value={mode === 'password' ? password : code}
                onChangeText={(t) => {
                  if (mode === 'password') setPassword(t);
                  else setCode(t.replace(/\D/g, '').slice(0, 6));
                  setLocalError(''); clearError();
                }}
                secureTextEntry={mode === 'password' && !showPassword}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />
              {mode === 'password' ? <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colors.textLight} />
              </TouchableOpacity> : null}
            </View>

            {mode === 'code' ? (
              <TouchableOpacity style={styles.codeBtn} onPress={handleSendCode} disabled={countdown > 0}>
                <Text style={styles.codeBtnText}>{countdown > 0 ? `${countdown}s 后重发` : '获取邮箱验证码'}</Text>
              </TouchableOpacity>
            ) : null}

            {displayError ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={14} color={Colors.error} />
                <Text style={styles.errorText}>{displayError}</Text>
              </View>
            ) : null}

            <View style={styles.modeRow}>
              <TouchableOpacity onPress={() => { setMode(mode === 'password' ? 'code' : 'password'); setLocalError(''); }}>
                <Text style={styles.forgotLink}>{mode === 'password' ? '邮箱验证码登录' : '密码登录'}</Text>
              </TouchableOpacity>
              {mode === 'password' ? <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password' as any)}>
                <Text style={styles.forgotLink}>忘记密码？</Text>
              </TouchableOpacity> : null}
            </View>

            <TouchableOpacity
              testID="login-submit-btn"
              style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.surface} size="small" />
              ) : (
                <Text style={styles.loginBtnText}>登 录</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.registerSection}>
          <Text style={styles.registerHint}>还没有账号？</Text>
          <TouchableOpacity testID="login-to-register-link" onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.registerLink}>立即注册</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.xxl },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: Spacing.md },
  logoSection: { alignItems: 'center', marginTop: 48, marginBottom: 36 },
  logoIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary + '15',
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg,
  },
  appName: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  welcomeText: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.sm },
  form: {},
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md,
    height: 52, borderWidth: 1.5, borderColor: Colors.border,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 0 },
  eyeBtn: { padding: 4 },
  errorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: Spacing.sm, paddingHorizontal: 4,
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error },
  forgotRow: { alignItems: 'flex-end', marginBottom: Spacing.xl },
  modeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xl },
  codeBtn: { alignItems: 'center', marginTop: -Spacing.sm, marginBottom: Spacing.md },
  codeBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  forgotLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '500' },
  loginBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, height: 52,
    justifyContent: 'center', alignItems: 'center', ...Shadows.md,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.surface, letterSpacing: 4 },
  registerSection: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: Spacing.xl, gap: 4, borderTopWidth: 0.5, borderTopColor: Colors.border,
  },
  registerHint: { fontSize: FontSize.sm, color: Colors.textSecondary },
  registerLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
});
