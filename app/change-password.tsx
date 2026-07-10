import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext';
import { safeBack } from '../src/utils/nav';
import { BorderRadius, Colors, FontSize, Shadows, Spacing } from '../src/utils/theme';

export default function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>请先登录</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('提示', '请填写完整信息');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('提示', '两次输入的新密码不一致');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('提示', '新密码至少 6 位');
      return;
    }

    setSaving(true);
    try {
      await changePassword({ oldPassword, newPassword });
      Alert.alert('修改成功', '密码已更新，请重新登录', [
        {
          text: '确定',
          onPress: async () => {
            await logout();
            safeBack();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('修改失败', error?.message || '请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>修改密码</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>旧密码</Text>
          <TextInput
            value={oldPassword}
            onChangeText={setOldPassword}
            secureTextEntry
            placeholder="请输入当前密码"
            placeholderTextColor={Colors.textLight}
            style={styles.input}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>新密码</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="请输入新密码"
            placeholderTextColor={Colors.textLight}
            style={styles.input}
          />
          <Text style={styles.hint}>建议包含字母和数字</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>确认新密码</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="请再次输入新密码"
            placeholderTextColor={Colors.textLight}
            style={styles.input}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
          disabled={saving}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator color={Colors.surface} /> : <Text style={styles.submitText}>保存新密码</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, gap: Spacing.lg },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  hint: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: Spacing.sm },
  submitBtn: {
    marginTop: Spacing.md,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: Colors.surface, fontSize: FontSize.md, fontWeight: '700' },
});
