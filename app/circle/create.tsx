import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { createCircle } from '../../src/services/circleService';
import { safeBack } from '../../src/utils/nav';
import { BorderRadius, Colors, FontSize, Spacing } from '../../src/utils/theme';

const COLORS = ['#4CAF50', '#5AC8FA', '#FF9800', '#E91E63', '#9C27B0'];
const EMOJIS = ['🐾', '🐱', '🐶', '📖', '📸'];

export default function CreateCirclePage() {
  const router = useRouter();
  const { status } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/(auth)/login');
    }
  }, [router, status]);

  const handleSubmit = useCallback(async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 30) {
      Alert.alert('提示', '圈子名称需为2-30个字符');
      return;
    }
    if (description.trim().length > 200) {
      Alert.alert('提示', '圈子简介最多200个字符');
      return;
    }
    setSubmitting(true);
    try {
      const circle = await createCircle({
        name: trimmedName,
        description: description.trim(),
        emoji,
        color,
      });
      router.replace(`/circle/${circle.id}`);
    } catch (error) {
      Alert.alert('创建失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }, [color, description, emoji, name, router]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={safeBack} style={styles.iconBtn} accessibilityLabel="返回">
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>创建圈子</Text>
        <View style={styles.iconBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.preview, { borderColor: color }]}>
          <Text style={styles.previewEmoji}>{emoji}</Text>
          <Text style={styles.previewName}>{name.trim() || '新圈子'}</Text>
        </View>

        <Text style={styles.label}>圈子名称</Text>
        <TextInput
          testID="create-circle-name-input"
          value={name}
          onChangeText={setName}
          maxLength={30}
          placeholder="例如：仓鼠乐园"
          placeholderTextColor={Colors.textLight}
          style={styles.input}
        />
        <Text style={styles.count}>{name.trim().length}/30</Text>

        <Text style={styles.label}>圈子简介</Text>
        <TextInput
          testID="create-circle-description-input"
          value={description}
          onChangeText={setDescription}
          maxLength={200}
          multiline
          placeholder="写下这个圈子适合讨论什么"
          placeholderTextColor={Colors.textLight}
          style={[styles.input, styles.textarea]}
          textAlignVertical="top"
        />

        <Text style={styles.label}>图标</Text>
        <View style={styles.optionRow}>
          {EMOJIS.map((item) => (
            <TouchableOpacity
              key={item}
              testID={`create-circle-emoji-${item}`}
              style={[styles.emojiOption, emoji === item && { borderColor: color }]}
              onPress={() => setEmoji(item)}
            >
              <Text style={styles.optionEmoji}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>主题色</Text>
        <View style={styles.optionRow}>
          {COLORS.map((item) => (
            <TouchableOpacity
              key={item}
              testID={`create-circle-color-${item}`}
              style={[styles.colorOption, { backgroundColor: item }, color === item && styles.colorOptionActive]}
              onPress={() => setColor(item)}
            />
          ))}
        </View>

        <TouchableOpacity
          testID="create-circle-submit-btn"
          style={[styles.submitBtn, (submitting || name.trim().length < 2) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || name.trim().length < 2}
        >
          {submitting ? <ActivityIndicator size="small" color={Colors.surface} /> : <Text style={styles.submitText}>创建并成为圈主</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  content: { padding: Spacing.xl, paddingBottom: Spacing.xxxl },
  preview: { alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 2, borderRadius: BorderRadius.lg, padding: Spacing.xl, marginBottom: Spacing.xl },
  previewEmoji: { fontSize: 40 },
  previewName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginTop: Spacing.sm },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.lg },
  input: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.text },
  textarea: { minHeight: 96 },
  count: { fontSize: FontSize.xs, color: Colors.textLight, textAlign: 'right', marginTop: Spacing.xs },
  optionRow: { flexDirection: 'row', gap: Spacing.sm },
  emojiOption: { width: 42, height: 42, borderRadius: BorderRadius.md, borderWidth: 2, borderColor: 'transparent', backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  optionEmoji: { fontSize: 22 },
  colorOption: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: 'transparent' },
  colorOptionActive: { borderColor: Colors.text },
  submitBtn: { height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, marginTop: Spacing.xxxl },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.surface },
});
