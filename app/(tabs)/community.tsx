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
  Image,
  ImageBackground,
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

const circleIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  c1: 'sparkles-outline',
  c2: 'leaf-outline',
  c3: 'walk-outline',
  c4: 'sunny-outline',
  c5: 'home-outline',
  c6: 'flash-outline',
};

export default function CommunityPage() {
  const router = useRouter();
  const { status, user } = useAuth();
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
      <ImageBackground
        source={require('../../assets/splash/community-friendship.png')}
        style={styles.cover}
        imageStyle={styles.coverImage}
      >
        <View style={styles.coverShade} />
        <View style={styles.coverTopBar}>
          <TouchableOpacity
            style={styles.coverIconBtn}
            onPress={() => router.push('/(tabs)/notification')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="打开通知"
          >
            <Ionicons name="notifications" size={20} color={Colors.surface} />
          </TouchableOpacity>
          <View style={styles.coverActions}>
            <TouchableOpacity
              style={styles.coverIconBtn}
              onPress={() => router.push('/(tabs)/wiki')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="打开品种百科"
            >
              <Ionicons name="book" size={20} color={Colors.surface} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="community-create-post-btn"
              style={styles.coverIconBtn}
              onPress={handleCreatePost}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="发布动态"
            >
              <Ionicons name="camera" size={22} color={Colors.surface} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileOverlay}>
          <View style={styles.coverTitleWrap}>
            <Text style={styles.coverTitle}>萌宠朋友圈</Text>
            <Text style={styles.coverSubtitle}>记录和毛孩子一起的日常</Text>
          </View>
          <View style={styles.profileAvatar}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.profileAvatarImage} />
            ) : (
              <Text style={styles.profileAvatarText}>{user?.nickname?.trim().slice(0, 1) || '宠'}</Text>
            )}
          </View>
        </View>
      </ImageBackground>

      {/* 品种圈子 */}
      <View style={styles.circleStrip}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>常逛圈子</Text>
          <TouchableOpacity
            testID="community-see-all-circles-btn"
            onPress={() => router.push('/circle')}
            accessibilityRole="button"
            accessibilityLabel="查看全部圈子"
          >
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
                accessibilityRole="button"
                accessibilityLabel={`${selectedCircle === item.id ? '取消筛选' : '筛选'}${item.name}`}
                onPress={() => {
                  setSelectedCircle(
                    selectedCircle === item.id ? null : item.id,
                  );
                }}
              >
                <View
                  style={[
                    styles.circleIcon,
                    selectedCircle === item.id && styles.circleIconActive,
                  ]}
                >
                  <Ionicons
                    name={circleIcons[item.id] || 'paw-outline'}
                    size={18}
                    color={selectedCircle === item.id ? Colors.surface : Colors.primary}
                  />
                </View>
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
      <View style={styles.feedToolbar}>
        <View>
          <Text style={styles.feedTitle}>宠友动态</Text>
          <Text style={styles.feedSubtitle}>{selectedCircle ? '当前只看这个圈子' : '来自全部圈子的近况'}</Text>
        </View>
        <View style={styles.tabRow}>
          <TouchableOpacity
            testID="community-tab-hot"
            style={[styles.tabItem, activeTab === 'hot' && styles.tabItemActive]}
            onPress={() => handleTabChange('hot')}
            accessibilityRole="button"
            accessibilityLabel="切换到热门动态"
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'hot' && styles.tabTextActive,
              ]}
            >
              热门
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="community-tab-latest"
            style={[
              styles.tabItem,
              activeTab === 'latest' && styles.tabItemActive,
            ]}
            onPress={() => handleTabChange('latest')}
            accessibilityRole="button"
            accessibilityLabel="切换到最新动态"
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'latest' && styles.tabTextActive,
              ]}
            >
              最新
            </Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: Colors.surface,
  },
  content: {
    paddingBottom: 100,
  },
  cover: {
    height: 310,
    justifyContent: 'space-between',
    backgroundColor: '#DDEFE8',
  },
  coverImage: {
    resizeMode: 'cover',
  },
  coverShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.14)',
  },
  coverTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  coverActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  coverIconBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileOverlay: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.xl,
    marginBottom: -30,
    gap: Spacing.md,
  },
  coverTitleWrap: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  coverTitle: {
    color: Colors.surface,
    fontSize: FontSize.xxl,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  coverSubtitle: {
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: FontSize.sm,
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.26)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 3,
    borderColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 7,
  },
  profileAvatarText: {
    color: Colors.primaryDark,
    fontSize: FontSize.title,
    fontWeight: '800',
  },
  circleStrip: {
    marginTop: 46,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  seeAll: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '500',
  },
  circleCard: {
    minWidth: 76,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.sm,
    backgroundColor: '#F6F7F8',
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  circleCardActive: {
    backgroundColor: Colors.primary + '18',
  },
  circleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  circleIconActive: {
    backgroundColor: Colors.primary,
  },
  circleName: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.text,
  },
  circleCount: {
    display: 'none',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  feedToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  feedTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  feedSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    padding: 3,
    ...Shadows.sm,
  },
  tabItem: {
    minWidth: 48,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
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
