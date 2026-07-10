/**
 * 社区广场页面
 * 品种圈子 + 帖子列表流（热门/最新切换）
 * 支持下拉刷新和上拉加载更多
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';
import { ensureLoggedIn } from '../../src/utils/nav';
import AnimatedListItem from '../../src/components/AnimatedListItem';
import PostCard from '../../src/components/community/PostCard';
import { getPosts, toggleLike, toggleBookmark } from '../../src/services/postService';
import useInfiniteScroll from '../../src/hooks/useInfiniteScroll';
import type { Post, CommunityCircle } from '../../src/types';

const circles: CommunityCircle[] = [
  { id: 'c1', name: '布偶圈', count: '1.2万', emoji: '🐱' },
  { id: 'c2', name: '英短圈', count: '9.8千', emoji: '🐱' },
  { id: 'c3', name: '柯基圈', count: '1.5万', emoji: '🐶' },
  { id: 'c4', name: '金毛圈', count: '2.1万', emoji: '🐶' },
  { id: 'c5', name: '橘猫圈', count: '8.5千', emoji: '🐱' },
  { id: 'c6', name: '哈士奇圈', count: '6.2千', emoji: '🐶' },
];

export default function CommunityPage() {
  const router = useRouter();
  const { status } = useAuth();
  const [activeTab, setActiveTab] = useState<'hot' | 'latest'>('hot');
  const [selectedCircle, setSelectedCircle] = useState<string | null>(null);
  const didFocusOnceRef = useRef(false);

  const loadPosts = useCallback(
    async (page: number, pageSize: number) => {
      const result = await getPosts(page, pageSize, activeTab, selectedCircle || undefined);
      return result.data;
    },
    [activeTab, selectedCircle],
  );

  const {
    data: posts,
    loading,
    hasMore,
    loadNextPage,
    refresh,
    setData,
  } = useInfiniteScroll<Post>({
    pageSize: 10,
    loadMore: loadPosts,
  });

  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!didFocusOnceRef.current) {
        didFocusOnceRef.current = true;
        return undefined;
      }

      refresh().catch(() => {});
      return undefined;
    }, [refresh]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // 切换排序时重置列表（loadMore 变化会自动触发刷新）
  const handleTabChange = useCallback((tab: 'hot' | 'latest') => {
    setActiveTab(tab);
  }, []);

  const handleLike = useCallback(
    async (post: Post) => {
      if (!ensureLoggedIn(status === 'authenticated', '点赞')) return;
      // 乐观更新
      setData((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                isLiked: !p.isLiked,
                likeCount: p.isLiked ? p.likeCount - 1 : p.likeCount + 1,
              }
            : p,
        ),
      );
      try {
        await toggleLike(post.id);
      } catch {
        // 回滚
        setData((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  isLiked: !p.isLiked,
                  likeCount: p.isLiked ? p.likeCount - 1 : p.likeCount + 1,
                }
              : p,
          ),
        );
      }
    },
    [setData, status],
  );

  const handleBookmark = useCallback(
    async (post: Post) => {
      if (!ensureLoggedIn(status === 'authenticated', '收藏')) return;
      setData((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, isBookmarked: !p.isBookmarked }
            : p,
        ),
      );
      try {
        await toggleBookmark(post.id);
      } catch {
        setData((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, isBookmarked: !p.isBookmarked }
              : p,
          ),
        );
      }
    },
    [setData, status],
  );

  const handlePostPress = useCallback(
    (post: Post) => {
      router.push(`/post/${post.id}`);
    },
    [router],
  );

  const handleCommentPress = useCallback(
    (post: Post) => {
      router.push(`/post/${post.id}`);
    },
    [router],
  );

  const handleCreatePost = useCallback(() => {
    if (!ensureLoggedIn(status === 'authenticated', '发帖')) return;
    router.push('/post/create');
  }, [router, status]);

  const renderHeader = () => (
    <View>
      {/* 品种圈子 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>品种圈子</Text>
          <TouchableOpacity testID="community-see-all-circles-btn" onPress={() => router.push('/circle')}>
            <Text style={styles.seeAll}>全部</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={circles}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.name}
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index} delay={80}>
              <TouchableOpacity
                testID={`community-circle-chip-${item.id}`}
                style={[
                  styles.circleCard,
                  selectedCircle === item.id && styles.circleCardActive,
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  setSelectedCircle(
                    selectedCircle === item.id ? null : item.id,
                  );
                }}
              >
                <Text style={styles.circleEmoji}>{item.emoji}</Text>
                <Text
                  style={[
                    styles.circleName,
                    selectedCircle === item.id && { color: Colors.primary },
                  ]}
                >
                  {item.name}
                </Text>
                <Text style={styles.circleCount}>{item.count}</Text>
              </TouchableOpacity>
            </AnimatedListItem>
          )}
        />
      </View>

      {/* 标签切换 */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          testID="community-tab-hot"
          style={[styles.tabItem, activeTab === 'hot' && styles.tabItemActive]}
          onPress={() => handleTabChange('hot')}
        >
          <Ionicons
            name="flame"
            size={14}
            color={activeTab === 'hot' ? Colors.surface : Colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'hot' && styles.tabTextActive,
            ]}
          >
            热门动态
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="community-tab-latest"
          style={[
            styles.tabItem,
            activeTab === 'latest' && styles.tabItemActive,
          ]}
          onPress={() => handleTabChange('latest')}
        >
          <Ionicons
            name="time"
            size={14}
            color={
              activeTab === 'latest' ? Colors.surface : Colors.textSecondary
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'latest' && styles.tabTextActive,
            ]}
          >
            最新发布
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!hasMore) {
      return (
        <View style={styles.footer}>
          <Text style={styles.footerText}>-- 没有更多了 --</Text>
        </View>
      );
    }
    if (loading && posts.length > 0) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.footerText}>加载中...</Text>
        </View>
      );
    }
    return null;
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.emptyText}>加载中...</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons name="document-text-outline" size={48} color={Colors.textLight} />
        <Text style={styles.emptyText}>暂无帖子</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={handleCreatePost}>
          <Text style={styles.emptyBtnText}>去发帖</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>社区广场</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.wikiBtn}
            onPress={() => router.push('/(tabs)/wiki')}
            activeOpacity={0.8}
          >
            <Ionicons name="book" size={16} color={Colors.primary} />
            <Text style={styles.wikiBtnText}>品种百科</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="community-create-post-btn"
            style={styles.postBtn}
            onPress={handleCreatePost}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color={Colors.surface} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <AnimatedListItem index={index} delay={60}>
            <PostCard
              post={item}
              onPress={handlePostPress}
              onLike={handleLike}
              onBookmark={handleBookmark}
              onComment={handleCommentPress}
            />
          </AnimatedListItem>
        )}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        onEndReached={() => {
          if (hasMore && !loading) loadNextPage();
        }}
        onEndReachedThreshold={0.3}
        removeClippedSubviews
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: '700',
    color: Colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  wikiBtn: {
    height: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary + '12',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  wikiBtnText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '700',
  },
  postBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 100,
  },
  section: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  seeAll: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '500',
  },
  circleCard: {
    width: 80,
    alignItems: 'center',
    marginRight: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  circleCardActive: {
    backgroundColor: Colors.primary + '10',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  circleEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  circleName: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.text,
  },
  circleCount: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
  },
  tabItemActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.surface,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  footerText: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl * 2,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  emptyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.sm,
  },
  emptyBtnText: {
    color: Colors.surface,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
