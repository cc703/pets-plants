import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { safeBack } from '../../src/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { resetPassword, sendSmsCode } = useAuth();

  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const smsRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((p) => (p <= 1 ? 0 : p - 1)), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendCode = useCallback(async () => {
    if (countdown > 0 || sendingCode) return;
    if (!phone.trim() || !/^1[3-9]\d{9}$/.test(phone.trim())) {
      setLocalError('请输入正确的手机号');
      return;
    }
    setSendingCode(true);
    setLocalError('');
    try {
      await sendSmsCode(phone.trim(), 'reset');
      setCountdown(60);
    } catch (err: any) {
      setLocalError(err.message || '发送验证码失败');
    } finally {
      setSendingCode(false);
    }
  }, [phone, countdown, sendingCode, sendSmsCode]);

  const handleSubmit = useCallback(async () => {
    setLocalError('');
    if (method === 'phone') {
      if (!phone.trim()) { setLocalError('请输入手机号'); return; }
      if (!smsCode.trim()) { setLocalError('请输入验证码'); return; }
    } else {
      if (!email.trim()) { setLocalError('请输入邮箱'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setLocalError('邮箱格式不正确'); return; }
    }
    if (!newPassword || newPassword.length < 6) { setLocalError('新密码至少6位'); return; }
    if (newPassword !== confirmPassword) { setLocalError('两次密码不一致'); return; }

    setLoading(true);
    try {
      await resetPassword({
        method,
        phone: method === 'phone' ? phone.trim() : undefined,
        email: method === 'email' ? email.trim() : undefined,
        smsCode: method === 'phone' ? smsCode.trim() : undefined,
        newPassword,
      });
      setSuccess(true);
    } catch (err: any) {
      setLocalError(err.message || '重置密码失败');
    } finally {
      setLoading(false);
    }
  }, [method, phone, email, smsCode, newPassword, confirmPassword, resetPassword]);

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>密码重置成功</Text>
          <Text style={styles.successSubtitle}>请使用新密码登录</Text>
          <TouchableOpacity style={styles.submitBtn} onPress={() => router.replace('/(auth)/login')} activeOpacity={0.85}>
            <Text style={styles.submitBtnText}>去登录</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>重置密码</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.description}>选择找回方式，我们将帮助你重置密码</Text>

          {/* 方式切换 */}
          <View style={styles.methodTabs}>
            <TouchableOpacity
              style={[styles.methodTab, method === 'phone' && styles.methodTabActive]}
              onPress={() => { setMethod('phone'); setLocalError(''); }}
            >
              <Text style={[styles.methodTabText, method === 'phone' && styles.methodTabTextActive]}>手机号找回</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.methodTab, method === 'email' && styles.methodTabActive]}
              onPress={() => { setMethod('email'); setLocalError(''); }}
            >
              <Text style={[styles.methodTabText, method === 'email' && styles.methodTabTextActive]}>邮箱找回</Text>
            </TouchableOpacity>
          </View>

          {method === 'phone' ? (
            <>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="请输入手机号" placeholderTextColor={Colors.textLight} value={phone} onChangeText={(t) => { setPhone(t); setLocalError(''); }} keyboardType="phone-pad" maxLength={11} />
              </View>
              <View style={styles.codeRow}>
                <View style={[styles.inputContainer, { flex: 1 }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
                  <TextInput ref={smsRef} style={styles.input} placeholder="请输入验证码" placeholderTextColor={Colors.textLight} value={smsCode} onChangeText={(t) => { setSmsCode(t); setLocalError(''); }} keyboardType="number-pad" maxLength={6} />
                </View>
                <TouchableOpacity style={[styles.codeBtn, countdown > 0 && styles.codeBtnDisabled]} onPress={handleSendCode} disabled={countdown > 0 || sendingCode}>
                  {sendingCode ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={[styles.codeBtnText, countdown > 0 && { color: Colors.textLight }]}>{countdown > 0 ? `${countdown}s` : '获取验证码'}</Text>}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="请输入邮箱" placeholderTextColor={Colors.textLight} value={email} onChangeText={(t) => { setEmail(t); setLocalError(''); }} keyboardType="email-address" autoCapitalize="none" />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
            <TextInput ref={passwordRef} style={styles.input} placeholder="请输入新密码（至少6位）" placeholderTextColor={Colors.textLight} value={newPassword} onChangeText={(t) => { setNewPassword(t); setLocalError(''); }} secureTextEntry={!showPassword} returnKeyType="next" onSubmitEditing={() => confirmRef.current?.focus()} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colors.textLight} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
            <TextInput ref={confirmRef} style={styles.input} placeholder="请确认新密码" placeholderTextColor={Colors.textLight} value={confirmPassword} onChangeText={(t) => { setConfirmPassword(t); setLocalError(''); }} secureTextEntry={!showPassword} returnKeyType="done" onSubmitEditing={handleSubmit} />
          </View>

          {localError ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color={Colors.error} />
              <Text style={styles.errorText}>{localError}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color={Colors.surface} /> : <Text style={styles.submitBtnText}>重置密码</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.xxl, paddingTop: Spacing.xl },
  description: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xxl, textAlign: 'center' },
  methodTabs: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: 4, marginBottom: Spacing.xxl, ...Shadows.sm },
  methodTab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  methodTabActive: { backgroundColor: Colors.primary + '12' },
  methodTabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  methodTabTextActive: { color: Colors.primary, fontWeight: '600' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.lg, height: 52, borderWidth: 1.5, borderColor: Colors.border, marginBottom: Spacing.md },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 0 },
  eyeBtn: { padding: 4 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  codeBtn: { height: 52, paddingHorizontal: Spacing.lg, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary + '15', borderRadius: BorderRadius.lg, minWidth: 100 },
  codeBtnDisabled: { opacity: 0.6 },
  codeBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm, paddingHorizontal: 4 },
  errorText: { fontSize: FontSize.sm, color: Colors.error },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, height: 52, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xl, ...Shadows.md },
  submitBtnText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.surface, letterSpacing: 2 },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl },
  successIcon: { marginBottom: Spacing.xxl },
  successTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  successSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xxxl },
});
