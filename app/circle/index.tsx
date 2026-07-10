/**
 * 圈子列表页
 * 展示所有圈子，支持加入/退出
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { safeBack } from '../../src/utils/nav';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';
import {
  getCircles,
  toggleJoinCircle,
  type Circle,
} from '../../src/services/circleService';

export default function CircleListPage() {
  const router = useRouter();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 加载圈子列表
  const loadCircles = useCallback(async () => {
    try {
      const data = await getCircles();
      setCircles(data);
    } catch (error) {
      console.error('Failed to load circles:', error);
    }
  }, []);

  // 初始化
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadCircles();
      setLoading(false);
    };
    init();
  }, [loadCircles]);

  // 下拉刷新
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCircles();
    setRefreshing(false);
  }, [loadCircles]);

  // 加入/退出圈子
  const handleToggleJoin = useCallback(async (circleId: string) => {
    try {
      const result = await toggleJoinCircle(circleId);
      setCircles(prev =>
        prev.map(c =>
          c.id === circleId
            ? {
                ...c,
                isJoined: result.isJoined,
                memberCount: result.isJoined ? c.memberCount + 1 : c.memberCount - 1,
              }
            : c
        )
      );
    } catch (error) {
      console.error('Failed to toggle join:', error);
    }
  }, []);

  // 渲染圈子卡片
  const renderCircleCard = ({ item }: { item: Circle }) => (
    <TouchableOpacity
      testID={`circle-list-card-${item.id}`}
      style={styles.circleCard}
      onPress={() => router.push(`/circle/${item.id}`)}
      activeOpacity={0.8}
    >
      <View style={[styles.circleAvatar, { backgroundColor: item.color + '20' }]}>
        <Text style={styles.circleEmoji}>{item.emoji}</Text>
      </View>
      <View style={styles.circleInfo}>
        <Text style={styles.circleName}>{item.name}</Text>
        <Text style={styles.circleDesc} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.circleStats}>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.statText}>{formatCount(item.memberCount)}人</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="document-text-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.statText}>{formatCount(item.postCount)}帖</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        testID={`circle-list-join-${item.id}`}
        style={[styles.joinBtn, item.isJoined && styles.joinedBtn]}
        onPress={() => handleToggleJoin(item.id)}
        activeOpacity={0.7}
      >
        <Text style={[styles.joinBtnText, item.isJoined && styles.joinedBtnText]}>
          {item.isJoined ? '已加入' : '加入'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 顶部导航 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>宠物圈子</Text>
        <TouchableOpacity style={styles.searchBtn}>
          <Ionicons name="search-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* 圈子列表 */}
      <FlatList
        data={circles}
        renderItem={renderCircleCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>暂无圈子</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// 格式化数字
function formatCount(count: number): string {
  if (count >= 10000) return (count / 10000).toFixed(1) + 'w';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
  return String(count);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  searchBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: Spacing.lg },
  circleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  circleAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  circleEmoji: { fontSize: 28 },
  circleInfo: { flex: 1 },
  circleName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  circleDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  circleStats: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  joinBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
    marginLeft: Spacing.sm,
  },
  joinedBtn: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  joinBtnText: { fontSize: FontSize.xs, color: Colors.surface, fontWeight: '600' },
  joinedBtnText: { color: Colors.textSecondary },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary },
});
