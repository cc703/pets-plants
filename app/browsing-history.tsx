import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeBack } from '../src/utils/nav';
import { BorderRadius, Colors, FontSize, Shadows, Spacing } from '../src/utils/theme';
import { useAuth } from '../src/contexts/AuthContext';
import {
  clearBrowsingHistory,
  getBrowsingHistory,
  removeBrowsingHistoryItem,
  type BrowsingHistoryItem,
} from '../src/services/historyService';

export default function BrowsingHistoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [history, setHistory] = useState<BrowsingHistoryItem[]>([]);

  const loadHistory = useCallback(async () => {
    const items = await getBrowsingHistory(user?.id);
    setHistory(items);
  }, [user?.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleOpen = (item: BrowsingHistoryItem) => {
    if (item.type === 'breed') router.push(`/breed/${item.targetId}`);
    else if (item.type === 'post') router.push(`/post/${item.targetId}`);
    else if (item.type === 'user') router.push(`/user/${item.targetId}`);
    else if (item.type === 'circle') router.push(`/circle/${item.targetId}`);
  };

  const handleClear = () => {
    Alert.alert('清空历史', '确定要清空所有浏览历史吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '清空',
        style: 'destructive',
        onPress: async () => {
          await clearBrowsingHistory(user?.id);
          setHistory([]);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>浏览历史</Text>
        <TouchableOpacity onPress={handleClear} style={styles.clearBtn} activeOpacity={0.8}>
          <Text style={styles.clearText}>清空</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>最近浏览内容</Text>
        {history.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.item}
            activeOpacity={0.8}
            onPress={() => handleOpen(item)}
          >
            <View style={styles.iconWrap}>
              <Text style={styles.emoji}>{item.icon}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
            <TouchableOpacity
              onPress={async () => {
                await removeBrowsingHistoryItem(item.id, user?.id);
                loadHistory();
              }}
              style={styles.removeBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={16} color={Colors.textLight} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
        {history.length === 0 && (
          <View style={styles.emptyWrap}>
            <Ionicons name="time-outline" size={42} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>还没有浏览记录</Text>
            <Text style={styles.emptySubtitle}>你浏览过的品种、帖子、用户和圈子会显示在这里</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
  clearBtn: { minWidth: 40, alignItems: 'flex-end' },
  clearText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  scroll: { flex: 1 },
  content: { padding: Spacing.xl, gap: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  emoji: { fontSize: 24 },
  info: { flex: 1 },
  name: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  removeBtn: { padding: 6, marginLeft: Spacing.sm },
  emptyWrap: { paddingVertical: Spacing.xxxl, alignItems: 'center', gap: Spacing.md },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textLight, textAlign: 'center', lineHeight: 20 },
});
