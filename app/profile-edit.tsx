import React, { useMemo, useState } from 'react';
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

export default function ProfileEditPage() {
  const { user, updateProfile } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);

  const remaining = useMemo(() => 200 - bio.length, [bio.length]);

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
    const finalNickname = nickname.trim();
    const finalBio = bio.trim();

    if (!finalNickname) {
      Alert.alert('提示', '昵称不能为空');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({ nickname: finalNickname, bio: finalBio });
      Alert.alert('保存成功', '资料已更新', [{ text: '确定', onPress: () => safeBack() }]);
    } catch (error: any) {
      Alert.alert('保存失败', error?.message || '请稍后重试');
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
        <Text style={styles.title}>编辑资料</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          disabled={saving}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator size="small" color={Colors.surface} /> : <Text style={styles.saveText}>保存</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>昵称</Text>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            maxLength={20}
            placeholder="请输入昵称"
            placeholderTextColor={Colors.textLight}
            style={styles.input}
          />
          <Text style={styles.hint}>1-20 个字符</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>个人简介</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            maxLength={200}
            placeholder="写一点关于你和宠物的故事..."
            placeholderTextColor={Colors.textLight}
            style={[styles.input, styles.bioInput]}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.metaRow}>
            <Text style={styles.hint}>最多 200 字</Text>
            <Text style={styles.counter}>{remaining}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>账号</Text>
          <View style={styles.readonlyRow}>
            <Ionicons name="person-circle-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.readonlyText}>{user.username}</Text>
          </View>
        </View>
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
  saveBtn: {
    minWidth: 56,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { color: Colors.surface, fontSize: FontSize.sm, fontWeight: '700' },
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
  bioInput: {
    height: 120,
    paddingTop: Spacing.md,
  },
  hint: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: Spacing.sm },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  counter: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },
  readonlyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  readonlyText: { fontSize: FontSize.md, color: Colors.text },
});
