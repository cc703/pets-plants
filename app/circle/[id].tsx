/**
 * 圈子详情页
 * 展示圈子信息、帖子列表
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
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ensureLoggedIn, safeBack } from '../../src/utils/nav';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { addBrowsingHistory } from '../../src/services/historyService';
import PostCard from '../../src/components/community/PostCard';
import {
  getCircleById,
  getCirclePosts,
  toggleJoinCircle,
  type Circle,
} from '../../src/services/circleService';
import type { Post } from '../../src/types';

type SortType = 'hot' | 'latest';

export default function CircleDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { status, user } = useAuth();

  const [circle, setCircle] = useState<Circle | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [sort, setSort] = useState<SortType>('hot');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // 加载圈子信息
  const loadCircle = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getCircleById(id);
      setCircle(data);
      addBrowsingHistory({
        type: 'circle',
        targetId: data.id,
        title: data.name,
        subtitle: data.description || '宠物圈子',
        icon: data.emoji || '💬',
      }, user?.id).catch(() => {});
    } catch (error) {
      console.error('Failed to load circle:', error);
    }
  }, [id, user?.id]);

  // 加载帖子
  const loadPosts = useCallback(async (pageNum: number = 1, refresh: boolean = false) => {
    if (!id || postsLoading) return;
    setPostsLoading(true);
    try {
      const result = await getCirclePosts(id, pageNum, 10, sort);
      if (refresh) {
        setPosts(result.data);
      } else {
        setPosts(prev => [...prev, ...result.data]);
      }
      setHasMore(result.data.length === 10);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setPostsLoading(false);
    }
  }, [id, sort, postsLoading]);

  // 初始化
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadCircle(), loadPosts(1, true)]);
      setLoading(false);
    };
    init();
  }, [loadCircle]);

  // 排序变化时重新加载
  useEffect(() => {
    loadPosts(1, true);
  }, [sort, loadPosts]);

  // 下拉刷新
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadCircle(), loadPosts(1, true)]);
    setRefreshing(false);
  }, [loadCircle, loadPosts]);

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (!postsLoading && hasMore) {
      loadPosts(page + 1);
    }
  }, [postsLoading, hasMore, page, loadPosts]);

  // 加入/退出圈子
  const handleToggleJoin = useCallback(async () => {
    if (!id || !circle) return;
    if (!ensureLoggedIn(status === 'authenticated', '加入圈子')) return;
    try {
      const result = await toggleJoinCircle(id);
      setCircle({
        ...circle,
        isJoined: result.isJoined,
        memberCount: result.isJoined ? circle.memberCount + 1 : circle.memberCount - 1,
      });
    } catch (error) {
      console.error('Failed to toggle join:', error);
    }
  }, [id, circle, status]);

  // 格式化数字
  const formatCount = (count: number): string => {
    if (count >= 10000) return (count / 10000).toFixed(1) + 'w';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
    return String(count);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!circle) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.textLight} />
          <Text style={styles.errorText}>圈子不存在</Text>
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
        <Text style={styles.headerTitle}>{circle.name}</Text>
        <TouchableOpacity style={styles.moreBtn}>
          <Ionicons name="ellipsis-horizontal" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() => router.push(`/post/${item.id}`)}
          />
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <>
            {/* 圈子信息卡片 */}
            <View style={styles.circleCard}>
              <View style={[styles.circleAvatar, { backgroundColor: circle.color + '20' }]}>
                <Text style={styles.circleEmoji}>{circle.emoji}</Text>
              </View>
              <Text style={styles.circleName}>{circle.name}</Text>
              <Text style={styles.circleDesc}>{circle.description}</Text>

              <View style={styles.circleStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statCount}>{formatCount(circle.memberCount)}</Text>
                  <Text style={styles.statLabel}>成员</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statCount}>{formatCount(circle.postCount)}</Text>
                  <Text style={styles.statLabel}>帖子</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.joinBtn, circle.isJoined && styles.joinedBtn]}
                onPress={handleToggleJoin}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={circle.isJoined ? 'checkmark' : 'add'}
                  size={16}
                  color={circle.isJoined ? Colors.textSecondary : Colors.surface}
                />
                <Text style={[styles.joinBtnText, circle.isJoined && styles.joinedBtnText]}>
                  {circle.isJoined ? '已加入' : '加入圈子'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 排序切换 */}
            <View style={styles.sortRow}>
              <TouchableOpacity
                style={[styles.sortBtn, sort === 'hot' && styles.sortBtnActive]}
                onPress={() => setSort('hot')}
              >
                <Ionicons
                  name="flame-outline"
                  size={14}
                  color={sort === 'hot' ? Colors.primary : Colors.textSecondary}
                />
                <Text style={[styles.sortBtnText, sort === 'hot' && styles.sortBtnTextActive]}>
                  最热
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortBtn, sort === 'latest' && styles.sortBtnActive]}
                onPress={() => setSort('latest')}
              >
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={sort === 'latest' ? Colors.primary : Colors.textSecondary}
                />
                <Text style={[styles.sortBtnText, sort === 'latest' && styles.sortBtnTextActive]}>
                  最新
                </Text>
              </TouchableOpacity>
            </View>
          </>
        }
        ListFooterComponent={
          postsLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} style={styles.loadingMore} />
          ) : !hasMore && posts.length > 0 ? (
            <Text style={styles.noMoreText}>没有更多了</Text>
          ) : null
        }
        ListEmptyComponent={
          !postsLoading ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>暂无帖子</Text>
              <Text style={styles.emptyHint}>快来发表第一篇帖子吧</Text>
            </View>
          ) : null
        }
      />

      {/* 发帖按钮 */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          if (!ensureLoggedIn(status === 'authenticated', '发帖')) return;
          router.push('/post/create');
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={24} color={Colors.surface} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  errorText: { fontSize: FontSize.md, color: Colors.textSecondary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  moreBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 100 },
  circleCard: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  circleAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  circleEmoji: { fontSize: 36 },
  circleName: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  circleDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  circleStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xl,
    width: '100%',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statCount: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: Colors.border },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
  },
  joinedBtn: {
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  joinBtnText: { fontSize: FontSize.sm, color: Colors.surface, fontWeight: '600' },
  joinedBtnText: { color: Colors.textSecondary },
  sortRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 4,
  },
  sortBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  sortBtnActive: { backgroundColor: Colors.primary + '12' },
  sortBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  sortBtnTextActive: { color: Colors.primary, fontWeight: '600' },
  loadingMore: { paddingVertical: Spacing.xl },
  noMoreText: {
    textAlign: 'center',
    paddingVertical: Spacing.xl,
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary },
  emptyHint: { fontSize: FontSize.sm, color: Colors.textLight },
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
});
