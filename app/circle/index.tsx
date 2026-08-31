/**
 * 圈子列表页
 * 展示所有圈子，支持加入/退出
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
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
import { ensureLoggedIn, safeBack } from '../../src/utils/nav';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  getCircles,
  getMyCircles,
  toggleJoinCircle,
  type Circle,
} from '../../src/services/circleService';

export default function CircleListPage() {
  const router = useRouter();
  const { status } = useAuth();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<{ circleId: string; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');

  // 加载圈子列表
  const loadCircles = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getCircles();
      setCircles(data);
    } catch {
      setCircles([]);
      setLoadError('圈子加载失败，请重试');
    }
  }, []);

  const loadMyCircles = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getMyCircles();
      setCircles(data);
    } catch {
      setCircles([]);
      setLoadError('我的圈子加载失败，请重试');
    }
  }, []);

  // 初始化
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await (activeTab === 'my' ? loadMyCircles() : loadCircles());
      setLoading(false);
    };
    init();
  }, [activeTab, loadCircles, loadMyCircles]);

  // 下拉刷新
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await (activeTab === 'my' ? loadMyCircles() : loadCircles());
    setRefreshing(false);
  }, [activeTab, loadCircles, loadMyCircles]);

  const handleTabChange = useCallback((tab: 'all' | 'my') => {
    if (tab === 'my' && !ensureLoggedIn(status === 'authenticated', '查看我的圈子')) return;
    setActiveTab(tab);
  }, [status]);

  // 加入/退出圈子
  const handleToggleJoin = useCallback(async (circleId: string) => {
    const target = circles.find((circle) => circle.id === circleId);
    if (!target) return;
    if (!ensureLoggedIn(status === 'authenticated', target.isJoined ? '退出圈子' : '加入圈子')) return;
    if (joiningId) return;
    if (target.isJoined) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert('退出圈子', `确定退出“${target.name}”吗？`, [
          { text: '取消', style: 'cancel', onPress: () => resolve(false) },
          { text: '退出', style: 'destructive', onPress: () => resolve(true) },
        ]);
      });
      if (!confirmed) return;
    }
    setJoiningId(circleId);
    setJoinError(null);
    try {
      const result = await toggleJoinCircle(circleId);
      setCircles(prev =>
        activeTab === 'my' && !result.isJoined
          ? prev.filter((circle) => circle.id !== circleId)
          : prev.map(c =>
              c.id === circleId
                ? {
                    ...c,
                    isJoined: result.isJoined,
                    memberCount: Math.max(0, result.isJoined ? c.memberCount + 1 : c.memberCount - 1),
                  }
                : c
            )
      );
    } catch {
      setJoinError({ circleId, message: '操作失败，请重试' });
    } finally {
      setJoiningId(null);
    }
  }, [activeTab, circles, joiningId, status]);

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
      <View style={styles.joinAction}>
        <TouchableOpacity
          testID={`circle-list-join-${item.id}`}
          style={[styles.joinBtn, item.isJoined && styles.joinedBtn]}
          onPress={() => handleToggleJoin(item.id)}
          disabled={joiningId !== null}
          activeOpacity={0.7}
        >
          {joiningId === item.id ? (
            <ActivityIndicator size="small" color={item.isJoined ? Colors.textSecondary : Colors.surface} />
          ) : (
            <Text style={[styles.joinBtnText, item.isJoined && styles.joinedBtnText]}>
              {item.isJoined ? '已加入' : '加入'}
            </Text>
          )}
        </TouchableOpacity>
        {joinError?.circleId === item.id ? <Text style={styles.actionError}>{joinError.message}</Text> : null}
      </View>
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
        <TouchableOpacity
          testID="circle-list-create-btn"
          style={styles.createBtn}
          onPress={() => {
            if (!ensureLoggedIn(status === 'authenticated', '创建圈子')) return;
            router.push('/circle/create');
          }}
          accessibilityRole="button"
          accessibilityLabel="创建圈子"
        >
          <Ionicons name="add" size={20} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          testID="circle-list-tab-all"
          style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
          onPress={() => handleTabChange('all')}
          accessibilityRole="button"
          accessibilityLabel="查看全部圈子"
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>全部圈子</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="circle-list-tab-my"
          style={[styles.tabBtn, activeTab === 'my' && styles.tabBtnActive]}
          onPress={() => handleTabChange('my')}
          accessibilityRole="button"
          accessibilityLabel="查看我的圈子"
        >
          <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>我的圈子</Text>
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
          loadError ? (
            <View style={styles.emptyState}>
              <Ionicons name="cloud-offline-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>{loadError}</Text>
              <TouchableOpacity
                testID="circle-list-retry-btn"
                style={styles.retryBtn}
                onPress={activeTab === 'my' ? loadMyCircles : loadCircles}
                accessibilityRole="button"
                accessibilityLabel="重试加载圈子"
              >
                <Text style={styles.retryBtnText}>重试</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>暂无圈子</Text>
            </View>
          )
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
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  tabBtnActive: { backgroundColor: Colors.primary + '12' },
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  searchBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  createBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
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
  joinAction: { alignItems: 'flex-end', marginLeft: Spacing.sm },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary },
  retryBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
  },
  retryBtnText: { fontSize: FontSize.sm, color: Colors.surface, fontWeight: '600' },
  actionError: { fontSize: FontSize.xs, color: Colors.accent, marginTop: 4 },
});
