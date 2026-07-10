/**
 * 用户主页
 * 展示用户信息、帖子、关注/粉丝、成就
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ensureLoggedIn, safeBack } from '../../src/utils/nav';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { addBrowsingHistory } from '../../src/services/historyService';
import PostCard from '../../src/components/community/PostCard';
import {
  getUserById,
  getUserPosts,
  toggleFollow,
  checkFollowStatus,
  getAchievements,
  formatCount,
  type Achievement,
} from '../../src/services/userService';
import { createConversation } from '../../src/services/messageService';
import type { UserBasic, Post } from '../../src/types';

type TabType = 'posts' | 'achievements';

export default function UserProfilePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: currentUser, status } = useAuth();

  const [profile, setProfile] = useState<UserBasic | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowedBy, setIsFollowedBy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);

  const isOwnProfile = currentUser?.id === id;

  // 加载用户信息
  const loadProfile = useCallback(async () => {
    if (!id) return;
    try {
      const [userData, followStatus] = await Promise.all([
        getUserById(id),
        isOwnProfile ? Promise.resolve({ isFollowing: false, isFollowedBy: false }) : checkFollowStatus(id),
      ]);
      setProfile(userData);
      if (!isOwnProfile) {
        addBrowsingHistory({
          type: 'user',
          targetId: userData.id,
          title: userData.nickname,
          subtitle: userData.bio || `Lv.${userData.level} 用户`,
          icon: '👤',
        }, currentUser?.id).catch(() => {});
      }
      setIsFollowing(followStatus.isFollowing);
      setIsFollowedBy(followStatus.isFollowedBy);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  }, [id, isOwnProfile, currentUser?.id]);

  // 加载帖子
  const loadPosts = useCallback(async () => {
    if (!id) return;
    setPostsLoading(true);
    try {
      const result = await getUserPosts(id);
      setPosts(result.data);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setPostsLoading(false);
    }
  }, [id]);

  // 加载成就
  const loadAchievements = useCallback(async () => {
    try {
      const data = await getAchievements(profile || undefined);
      setAchievements(data);
    } catch (error) {
      console.error('Failed to load achievements:', error);
    }
  }, [profile]);

  // 初始化
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadProfile(), loadPosts(), loadAchievements()]);
      setLoading(false);
    };
    init();
  }, [loadProfile, loadPosts, loadAchievements]);

  // 下拉刷新
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadProfile(), loadPosts()]);
    setRefreshing(false);
  }, [loadProfile, loadPosts]);

  // 关注/取消关注
  const handleToggleFollow = useCallback(async () => {
    if (!id) return;
    if (!ensureLoggedIn(status === 'authenticated', '关注用户')) return;
    try {
      const result = await toggleFollow(id);
      setIsFollowing(result.isFollowing);
      if (profile) {
        setProfile({
          ...profile,
          followerCount: result.isFollowing
            ? profile.followerCount + 1
            : profile.followerCount - 1,
        });
      }
    } catch (error) {
      console.error('Failed to toggle follow:', error);
    }
  }, [id, profile, status]);

  const handleOpenConversation = useCallback(async () => {
    if (!id || isOwnProfile) return;
    if (!ensureLoggedIn(status === 'authenticated', '私信')) return;
    try {
      const conversation = await createConversation(id);
      router.push(`/message/${conversation.id}`);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  }, [id, isOwnProfile, router, status]);

  // 渲染用户头像
  const renderAvatar = (size: number = 80) => (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <LinearGradient
        colors={[Colors.primary + '40', Colors.primaryLight + '20']}
        style={[styles.avatarGradient, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Ionicons name="person" size={size * 0.5} color={Colors.primary} />
      </LinearGradient>
    </View>
  );

  // 渲染统计数字
  const renderStat = (label: string, count: number) => (
    <TouchableOpacity style={styles.statItem} activeOpacity={0.7}>
      <Text style={styles.statCount}>{formatCount(count)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );

  // 渲染成就卡片
  const renderAchievement = (achievement: Achievement) => (
    <View
      key={achievement.id}
      style={[styles.achievementCard, !achievement.unlocked && styles.achievementLocked]}
    >
      <View style={[styles.achievementIcon, { backgroundColor: achievement.color + '20' }]}>
        <Ionicons
          name={achievement.icon as any}
          size={24}
          color={achievement.unlocked ? achievement.color : Colors.textLight}
        />
      </View>
      <View style={styles.achievementInfo}>
        <Text style={[styles.achievementName, !achievement.unlocked && styles.achievementNameLocked]}>
          {achievement.name}
        </Text>
        <Text style={styles.achievementDesc}>{achievement.description}</Text>
      </View>
      {achievement.unlocked && (
        <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
      )}
    </View>
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

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.textLight} />
          <Text style={styles.errorText}>用户不存在</Text>
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
        <Text style={styles.headerTitle}>{isOwnProfile ? '我的主页' : profile.nickname}</Text>
        <TouchableOpacity style={styles.moreBtn}>
          <Ionicons name="ellipsis-horizontal" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
      >
        {/* 用户信息卡片 */}
        <View style={styles.profileCard}>
          {renderAvatar(80)}
          <Text style={styles.nickname}>{profile.nickname}</Text>
          <Text style={styles.levelText}>Lv.{profile.level}</Text>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          {/* 统计数据 */}
          <View style={styles.statsRow}>
            {renderStat('帖子', profile.postCount)}
            <View style={styles.statDivider} />
            {renderStat('粉丝', profile.followerCount)}
            <View style={styles.statDivider} />
            {renderStat('关注', profile.followingCount)}
            <View style={styles.statDivider} />
            {renderStat('获赞', profile.likeCount)}
          </View>

          {/* 操作按钮 */}
          {isOwnProfile ? (
            <TouchableOpacity style={styles.editBtn} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={16} color={Colors.primary} />
              <Text style={styles.editBtnText}>编辑资料</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.followBtn, isFollowing && styles.followingBtn]}
                onPress={handleToggleFollow}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isFollowing ? 'checkmark' : 'add'}
                  size={16}
                  color={isFollowing ? Colors.textSecondary : Colors.surface}
                />
                <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                  {isFollowing ? '已关注' : '关注'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.messageBtn} activeOpacity={0.8} onPress={handleOpenConversation}>
                <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* 互相关注提示 */}
          {isFollowedBy && isFollowing && (
            <View style={styles.mutualFollow}>
              <Ionicons name="people" size={12} color={Colors.primary} />
              <Text style={styles.mutualFollowText}>互相关注</Text>
            </View>
          )}
        </View>

        {/* Tab 切换 */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
            onPress={() => setActiveTab('posts')}
          >
            <Ionicons
              name="grid-outline"
              size={16}
              color={activeTab === 'posts' ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
              帖子
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'achievements' && styles.tabActive]}
            onPress={() => setActiveTab('achievements')}
          >
            <Ionicons
              name="trophy-outline"
              size={16}
              color={activeTab === 'achievements' ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'achievements' && styles.tabTextActive]}>
              成就
            </Text>
          </TouchableOpacity>
        </View>

        {/* 帖子列表 */}
        {activeTab === 'posts' && (
          <View style={styles.contentSection}>
            {postsLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} style={styles.loadingIndicator} />
            ) : posts.length > 0 ? (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPress={() => router.push(`/post/${post.id}`)}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color={Colors.textLight} />
                <Text style={styles.emptyText}>暂无帖子</Text>
              </View>
            )}
          </View>
        )}

        {/* 成就列表 */}
        {activeTab === 'achievements' && (
          <View style={styles.contentSection}>
            <View style={styles.achievementStats}>
              <Text style={styles.achievementStatsText}>
                已解锁 {achievements.filter(a => a.unlocked).length}/{achievements.length}
              </Text>
            </View>
            {achievements.map(renderAchievement)}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  profileCard: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  avatar: { marginBottom: Spacing.md },
  avatarGradient: { justifyContent: 'center', alignItems: 'center' },
  nickname: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  levelText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  bio: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xl,
    width: '100%',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statCount: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: Colors.border },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  editBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
  },
  followingBtn: {
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  followBtnText: { fontSize: FontSize.sm, color: Colors.surface, fontWeight: '600' },
  followingBtnText: { color: Colors.textSecondary },
  messageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mutualFollow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
  },
  mutualFollowText: { fontSize: FontSize.xs, color: Colors.primary },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  tabActive: { backgroundColor: Colors.primary + '12' },
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },
  contentSection: { paddingHorizontal: Spacing.lg, marginTop: Spacing.md },
  loadingIndicator: { marginTop: Spacing.xl },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary },
  achievementStats: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.md,
  },
  achievementStatsText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  achievementLocked: { opacity: 0.6 },
  achievementIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  achievementInfo: { flex: 1 },
  achievementName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  achievementNameLocked: { color: Colors.textSecondary },
  achievementDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  bottomSpacer: { height: 100 },
});
