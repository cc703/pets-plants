import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { safeBack } from '../../src/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';

export default function RegisterPage() {
  const router = useRouter();
  const { register, status, error, clearError } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const isLoading = status === 'loading';
  const prevStatusRef = useRef(status);

  // 注册成功后提示跳转登录
  useEffect(() => {
    if (prevStatusRef.current === 'loading' && status === 'authenticated') {
      router.replace('/(tabs)');
    }
    prevStatusRef.current = status;
  }, [status, router]);

  const handleRegister = useCallback(async () => {
    setLocalError('');
    clearError();

    if (!username.trim()) { setLocalError('请输入用户名'); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) { setLocalError('用户名需3-20位，仅限字母数字下划线'); return; }
    if (!password) { setLocalError('请输入密码'); return; }
    if (password.length < 6) { setLocalError('密码至少6位'); return; }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) { setLocalError('密码需包含字母和数字'); return; }
    if (password !== confirmPassword) { setLocalError('两次密码不一致'); return; }

    await register({
      method: 'phone',
      username: username.trim(),
      password,
      nickname: nickname.trim() || undefined,
    });
  }, [username, password, confirmPassword, nickname, isLoading, register, clearError]);

  const displayError = localError || error;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>创建账号</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.iconSection}>
            <View style={styles.iconCircle}>
              <Ionicons name="person-add" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.welcomeText}>加入萌宠星球</Text>
            <Text style={styles.welcomeSub}>创建账号，开启你的萌宠之旅</Text>
          </View>

          <View style={styles.formSection}>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput
                testID="register-username-input"
                style={styles.input}
                placeholder="用户名（3-20位字母数字下划线）"
                placeholderTextColor={Colors.textLight}
                value={username}
                onChangeText={(t) => { setUsername(t); setLocalError(''); clearError(); }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput
                testID="register-password-input"
                style={styles.input}
                placeholder="密码（至少6位，含字母和数字）"
                placeholderTextColor={Colors.textLight}
                value={password}
                onChangeText={(t) => { setPassword(t); setLocalError(''); }}
                secureTextEntry={!showPassword}
                maxLength={32}
                returnKeyType="next"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colors.textLight} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput
                testID="register-confirm-password-input"
                style={styles.input}
                placeholder="确认密码"
                placeholderTextColor={Colors.textLight}
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setLocalError(''); }}
                secureTextEntry={!showPassword}
                maxLength={32}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="happy-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput
                testID="register-nickname-input"
                style={styles.input}
                placeholder="昵称（选填）"
                placeholderTextColor={Colors.textLight}
                value={nickname}
                onChangeText={(t) => { setNickname(t); setLocalError(''); }}
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
            </View>
          </View>

          {displayError ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color={Colors.error} />
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            testID="register-submit-btn"
            style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.surface} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>注 册</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginSection}>
            <Text style={styles.loginHint}>已有账号？</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginLink}>去登录</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.xxl },
  iconSection: { alignItems: 'center', marginTop: Spacing.xxxl, marginBottom: Spacing.xxl },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary + '15',
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg,
  },
  welcomeText: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text },
  welcomeSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  formSection: { gap: Spacing.md },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.lg, height: 52,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 0 },
  eyeBtn: { padding: 4 },
  errorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: Spacing.md, paddingHorizontal: 4,
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, height: 52,
    justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xxl, ...Shadows.md,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.surface, letterSpacing: 2 },
  loginSection: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: Spacing.xxl, paddingBottom: Spacing.xxxl, gap: 4,
  },
  loginHint: { fontSize: FontSize.sm, color: Colors.textSecondary },
  loginLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
});
