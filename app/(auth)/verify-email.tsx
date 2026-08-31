import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../src/services/authApi';
import { Colors, FontSize, Spacing } from '../../src/utils/theme';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('正在验证邮箱…');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('验证链接缺少 token');
      return;
    }
    authApi.verifyEmail(String(token))
      .then(() => {
        setStatus('success');
        setMessage('邮箱验证成功，现在可以正常使用社区功能。');
      })
      .catch((error: any) => {
        setStatus('error');
        setMessage(error.message || '验证链接无效或已过期');
      });
  }, [token]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {status === 'loading' ? (
          <ActivityIndicator color={Colors.primary} size="large" />
        ) : (
          <Ionicons
            name={status === 'success' ? 'checkmark-circle' : 'alert-circle'}
            size={72}
            color={status === 'success' ? Colors.success : Colors.error}
          />
        )}
        <Text style={styles.title}>{status === 'success' ? '邮箱已验证' : status === 'error' ? '验证失败' : '验证邮箱'}</Text>
        <Text style={styles.message}>{message}</Text>
        {status !== 'loading' ? (
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.buttonText}>返回登录</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  title: { marginTop: Spacing.lg, fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text },
  message: { marginTop: Spacing.md, textAlign: 'center', color: Colors.textSecondary, fontSize: FontSize.md },
  button: { marginTop: Spacing.xxl, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, backgroundColor: Colors.primary, borderRadius: 12 },
  buttonText: { color: Colors.surface, fontWeight: '700', fontSize: FontSize.md },
});
