import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Switch, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';
import PetIllustration from '../../src/components/PetIllustration';
import { useAuth } from '../../src/contexts/AuthContext';
import { requireLogin } from '../../src/utils/nav';
import { useUserPet } from '../../src/contexts/UserPetContext';
import { getBrowsingHistory } from '../../src/services/historyService';
import { pointsService, type PointsSummary } from '../../src/services/pointsService';
import { getAchievements, getUserById, type Achievement } from '../../src/services/userService';
import { getBookmarks, getUserPosts } from '../../src/services/postService';
import type { BookmarkItem, MenuItem, Post } from '../../src/types';
import type { User } from '../../src/services/authApi';
import type { UserBasic } from '../../src/types';
interface FavoriteItem { id: string; type: 'post'; title: string; subtitle: string; icon: string; postId: string; }

const menuItemsBase: (MenuItem & { action: string })[] = [
  { icon: 'notifications', label: '消息通知', count: '', color: '#FF6B6B', action: 'notification' },
  { icon: 'help-circle', label: '知识答题', count: '', color: Colors.primary, action: 'quiz' },
  { icon: 'heart', label: '我的收藏', count: '', color: Colors.accent, action: 'favorites' },
  { icon: 'chatbubbles', label: '私信', count: '', color: Colors.primary, action: 'message' },
  { icon: 'albums', label: '我的集卡', count: '12/48', color: Colors.secondary, action: 'cards' },
  { icon: 'trophy', label: '成就徽章', count: '6', color: '#FFD93D', action: 'achievements' },
  { icon: 'cart', label: '积分商城', count: '', color: '#FF8C00', action: 'shop' },
  { icon: 'time', label: '浏览历史', count: '', color: Colors.textSecondary, action: 'history' },
  { icon: 'create', label: '我的发布', count: '', color: '#9B5DE5', action: 'posts' },
];

/** 计算注册天数 */
function getDaysSince(createdAt?: string): number {
  if (!createdAt) return 1;
  const created = new Date(createdAt);
  if (isNaN(created.getTime())) return 1;
  const now = new Date();
  return Math.max(1, Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
}

function getSexLabel(sex?: string | null): string {
  if (sex === 'male') return '男孩';
  if (sex === 'female') return '女孩';
  return '未填写性别';
}

// ========== 未登录状态视图 ==========

function GuestProfile() {
  const router = useRouter();

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      {/* 登录引导卡片 */}
      <View style={styles.guestCard}>
        <LinearGradient colors={[Colors.primary + '20', Colors.primary + '08']} style={styles.guestGradient}>
          <View style={styles.guestAvatar}>
            <Ionicons name="paw" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.guestTitle}>登录萌宠星球</Text>
          <Text style={styles.guestSubtitle}>登录后享受完整功能，记录你的萌宠生活</Text>
          <TouchableOpacity
            testID="guest-login-register-btn"
            style={styles.loginBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.loginBtnText}>登录 / 注册</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* 积分入口（游客） */}
      <TouchableOpacity
        style={styles.checkInCard}
        activeOpacity={0.85}
        onPress={() => Alert.alert('提示', '登录后即可签到赚积分', [
          { text: '取消' },
          { text: '去登录', onPress: () => router.push('/(auth)/login') },
        ])}
      >
        <LinearGradient colors={[Colors.primary + '20', Colors.primary + '08']} style={styles.checkInGradient}>
          <View style={styles.checkInLeft}>
            <Ionicons name="gift" size={28} color={Colors.primary} />
            <View style={styles.checkInInfo}>
              <Text style={styles.checkInTitle}>签到赚积分</Text>
              <Text style={styles.checkInSub}>登录后每日签到获取积分奖励</Text>
            </View>
          </View>
          <View style={styles.checkInBtn}>
            <Text style={styles.checkInBtnText}>登录</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* 游客可浏览的内容 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>探索更多</Text>
        {[
          { icon: 'book-outline' as const, label: '品种百科', desc: '了解各种宠物品种', color: Colors.primary, action: 'wiki' },
          { icon: 'notifications-outline' as const, label: '消息通知', desc: '查看互动消息和系统通知', color: '#FF6B6B', action: 'notification' },
          { icon: 'help-circle-outline' as const, label: '知识答题', desc: '趣味答题增长宠物知识', color: Colors.primary, action: 'quiz' },
          { icon: 'cart-outline' as const, label: '积分商城', desc: '用积分兑换好礼', color: '#FF8C00', action: 'shop' },
          { icon: 'information-circle-outline' as const, label: '关于我们', desc: '了解萌宠星球', color: Colors.textSecondary, action: 'about' },
          { icon: 'settings-outline' as const, label: '设置', desc: '语言、主题等偏好', color: Colors.textSecondary, action: 'settings' },
        ].map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.guestMenuItem}
            activeOpacity={0.7}
            onPress={() => {
              if (item.action === 'wiki') router.push('/(tabs)/wiki');
              else if (item.action === 'about') router.push('/about');
              else if (item.action === 'settings') router.push('/settings');
              else requireLogin(item.label);
            }}
          >
            <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}>
              <Ionicons name={item.icon} size={20} color={item.color} />
            </View>
            <View style={styles.guestMenuInfo}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.guestMenuDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// ========== 已登录状态视图 ==========

function UserProfile({ user, onLogout }: { user: User; onLogout: () => void }) {
  const router = useRouter();
  const { pet: primaryPet, status: primaryPetStatus, error: primaryPetError, refresh: refreshPrimaryPet } = useUserPet();
  const { updatePreferences } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [autoPlayVideo, setAutoPlayVideo] = useState(true);
  const [pointsSummary, setPointsSummary] = useState<PointsSummary | null>(null);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [favoritePosts, setFavoritePosts] = useState<FavoriteItem[]>([]);
  const [favoriteCount, setFavoriteCount] = useState<number | null>(null);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [postCount, setPostCount] = useState<number | null>(null);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [profileStats, setProfileStats] = useState<UserBasic | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [historyCount, setHistoryCount] = useState(0);

  useEffect(() => {
    setNotificationsEnabled(user.preferences?.notifications ?? true);
    setDarkModeEnabled(user.preferences?.darkMode ?? false);
    setAutoPlayVideo(user.preferences?.autoPlayVideo ?? true);
  }, [user.preferences]);

  const menuItems = menuItemsBase.map((item) => {
    if (item.action === 'favorites') {
      return { ...item, count: favoriteCount !== null && favoriteCount > 0 ? String(favoriteCount) : favoritesLoading ? '...' : '' };
    }
    if (item.action === 'posts') {
      return { ...item, count: postCount !== null ? String(postCount) : postsLoading ? '...' : '' };
    }
    if (item.action === 'message') {
      return { ...item, count: '' };
    }
    if (item.action === 'history') {
      return { ...item, count: historyCount > 0 ? String(historyCount) : '' };
    }
    return item;
  });

  const loadPointsSummary = useCallback(async () => {
    setPointsLoading(true);
    setPointsError(null);
    try {
      const summary = await pointsService.getSummary();
      setPointsSummary(summary);
    } catch {
      setPointsError('积分数据加载失败');
    } finally {
      setPointsLoading(false);
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    setFavoritesLoading(true);
    setFavoritesError(null);
    try {
      const result = await getBookmarks(1, 20);
      const favorites = result.data.map((item) => ({
        id: item.id,
        type: 'post' as const,
        title: item.post.content.slice(0, 24) || item.targetTitle || '已收藏帖子',
        subtitle: item.post.tags.length > 0 ? `#${item.post.tags.join(' #')}` : '社区帖子收藏',
        icon: '📝',
        postId: item.postId,
      }));
      setFavoritePosts(favorites);
      setFavoriteCount(result.total);
    } catch {
      setFavoritesError('收藏数据加载失败');
    } finally {
      setFavoritesLoading(false);
    }
  }, []);

  const loadUserPosts = useCallback(async () => {
    setPostsLoading(true);
    setPostsError(null);
    try {
      const result = await getUserPosts(user.id, 1, 10);
      setPostCount(result.total);
      setRecentPosts(result.data.slice(0, 3));
    } catch {
      setPostsError('发布数据加载失败');
    } finally {
      setPostsLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadPointsSummary();
    loadFavorites();
    loadUserPosts();
    getUserById(user.id).then((result) => {
      setProfileStats(result);
      return getAchievements(result);
    }).then((items) => {
      setAchievements(items);
    }).catch(() => {
      setProfileStats(null);
      setAchievements([]);
    });
    getBrowsingHistory(user.id).then((items) => setHistoryCount(items.length)).catch(() => setHistoryCount(0));
  }, [user.id, loadPointsSummary, loadFavorites, loadUserPosts]);

  useFocusEffect(
    useCallback(() => {
      loadUserPosts();
    }, [loadUserPosts]),
  );

  const handleCheckIn = useCallback(async () => {
    if (pointsSummary?.checkedInToday || checkingIn) return;
    setCheckingIn(true);
    try {
      const result = await pointsService.checkIn();
      await loadPointsSummary();
      Alert.alert('签到成功', result.message);
    } catch (err: any) {
      if (err?.code === 3001) {
        await loadPointsSummary();
      } else {
        Alert.alert('提示', '签到失败，请稍后重试');
      }
    } finally {
      setCheckingIn(false);
    }
  }, [pointsSummary?.checkedInToday, checkingIn, loadPointsSummary]);

  const handlePreferenceChange = async (
    key: 'notifications' | 'darkMode' | 'autoPlayVideo',
    value: boolean,
  ) => {
    try {
      if (key === 'notifications') setNotificationsEnabled(value);
      if (key === 'darkMode') setDarkModeEnabled(value);
      if (key === 'autoPlayVideo') setAutoPlayVideo(value);
      await updatePreferences({ [key]: value });
    } catch {
      Alert.alert('提示', '设置保存失败，请重试');
    }
  };

  const handleMenuPress = useCallback((action: string) => {
    if (action === 'favorites') setShowFavorites(true);
    else if (action === 'achievements') setShowAchievements(true);
    else if (action === 'message') router.push('/message');
    else if (action === 'notification') router.push('/(tabs)/notification');
    else if (action === 'quiz') router.push('/(tabs)/quiz');
    else if (action === 'shop') router.push('/points-shop');
    else if (action === 'posts') router.push('/my-posts');
    else if (action === 'history') router.push('/browsing-history');
    else Alert.alert('提示', '功能即将上线，敬请期待！');
  }, [router, user.id]);

  const daysSince = getDaysSince(user.createdAt);
  const checkedIn = Boolean(pointsSummary?.checkedInToday);
  const streak = pointsSummary?.currentStreak ?? 0;
  const currentPoints = pointsSummary?.points;
  const petSpecies = primaryPet?.breed?.species === 'dog' ? 'dog' : 'cat';
  const petBirthday = primaryPet?.birthday ? `生日 ${primaryPet.birthday}` : '生日未填写';

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* 用户信息卡片 */}
        <View style={styles.profileCard}>
          <LinearGradient colors={[Colors.primary + '15', Colors.primary + '05']} style={styles.avatarGradient}>
            <View style={styles.avatar}>
              {user.avatarUrl ? (
                <Text style={styles.avatarText}>{user.nickname?.[0] || '?'}</Text>
              ) : (
                <Ionicons name="person" size={32} color={Colors.primary} />
              )}
            </View>
          </LinearGradient>
          <Text style={styles.userName}>{user.nickname || user.username}</Text>
          <View style={styles.levelRow}>
            <View style={styles.levelBadge}><Text style={styles.levelText}>Lv.{user.level ?? 1}</Text></View>
            <Text style={styles.userMeta}>注册 {daysSince} 天</Text>
          </View>
          {user.bio ? <Text style={styles.userBio}>{user.bio}</Text> : null}
        </View>

        {/* 统计数据 */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text testID="profile-points-value" style={styles.statValue}>
              {currentPoints !== undefined ? currentPoints.toLocaleString() : pointsLoading ? '...' : '--'}
            </Text>
            <Text style={styles.statLabel}>金币</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Text style={styles.statValue}>Lv.{user.level ?? 1}</Text><Text style={styles.statLabel}>等级</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Text style={styles.statValue}>{getDaysSince(user.createdAt)}</Text><Text style={styles.statLabel}>注册天数</Text></View>
        </View>
        {pointsError ? (
          <TouchableOpacity testID="profile-data-retry" style={styles.dataRetry} onPress={loadPointsSummary}>
            <Text style={styles.dataError}>{pointsError}</Text>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        ) : null}

        {/* 签到卡片 */}
        <TouchableOpacity
          testID="profile-check-in-btn"
          style={[styles.checkInCard, checkedIn && styles.checkInCardDone]}
          activeOpacity={0.85}
          onPress={handleCheckIn}
          disabled={checkedIn || checkingIn}
        >
          <LinearGradient
            colors={checkedIn ? [Colors.success + '20', Colors.success + '08'] : [Colors.primary + '20', Colors.primary + '08']}
            style={styles.checkInGradient}
          >
            <View style={styles.checkInLeft}>
              <Ionicons name={checkedIn ? 'checkmark-circle' : 'calendar'} size={28} color={checkedIn ? Colors.success : Colors.primary} />
              <View style={styles.checkInInfo}>
                <Text style={styles.checkInTitle}>{checkedIn ? '今日已签到' : '每日签到'}</Text>
                <Text style={styles.checkInSub}>{checkedIn ? `连续${streak}天` : '签到获取积分奖励'}</Text>
              </View>
            </View>
            {!checkedIn && (
              <View style={styles.checkInBtn}>
                <Text style={styles.checkInBtnText}>+10</Text>
              </View>
            )}
            {checkedIn && streak > 0 && (
              <View style={[styles.checkInBtn, { backgroundColor: Colors.success + '20' }]}>
                <Text style={[styles.checkInBtnText, { color: Colors.success }]}>🔥{streak}</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* 我的宠物 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>我的宠物</Text>
          {primaryPetStatus === 'loading' && !primaryPet ? (
            <View style={styles.petCard}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <View style={styles.petInfo}>
                <Text style={styles.petName}>正在读取宠物档案</Text>
                <Text style={styles.petBreed}>同步你的真实主宠信息</Text>
              </View>
            </View>
          ) : primaryPet ? (
            <TouchableOpacity style={styles.petCard} activeOpacity={0.85} onPress={() => router.push('/(tabs)/pet')}>
              <View style={styles.petAvatar}>
                {primaryPet.avatarUrl ? (
                  <Image source={{ uri: primaryPet.avatarUrl }} style={styles.petAvatarImage} />
                ) : (
                  <PetIllustration species={petSpecies} size={60} color={Colors.primary} />
                )}
              </View>
              <View style={styles.petInfo}>
                <Text testID="profile-primary-pet-name" style={styles.petName}>{primaryPet.name}</Text>
                <Text style={styles.petBreed}>{primaryPet.breed?.name || '未知品种'}</Text>
                <View style={styles.petStats}>
                  <View style={styles.petStatItem}><Ionicons name="male-female" size={12} color={Colors.accent} /><Text style={styles.petStatText}>{getSexLabel(primaryPet.sex)}</Text></View>
                  <View style={styles.petStatItem}><Ionicons name="calendar-outline" size={12} color={Colors.primary} /><Text style={styles.petStatText}>{petBirthday}</Text></View>
                </View>
              </View>
              <TouchableOpacity style={styles.enterBtn} onPress={() => router.push('/(tabs)/pet')}><Text style={styles.enterBtnText}>进入</Text></TouchableOpacity>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.petCard} activeOpacity={0.85} onPress={() => router.push('/(tabs)/pet')}>
              <View style={styles.petAvatar}><Ionicons name="add-circle-outline" size={40} color={Colors.primary} /></View>
              <View style={styles.petInfo}>
                <Text style={styles.petName}>还没有宠物</Text>
                <Text style={styles.petBreed}>{primaryPetError || '去创建你的真实主宠档案'}</Text>
              </View>
              {primaryPetError ? (
                <TouchableOpacity style={styles.enterBtn} onPress={() => refreshPrimaryPet().catch(() => undefined)}><Text style={styles.enterBtnText}>重试</Text></TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          )}
        </View>
        {(favoritesError || postsError) ? (
          <View style={styles.section}>
            {favoritesError ? (
              <TouchableOpacity style={styles.inlineRetry} onPress={loadFavorites}>
                <Text style={styles.dataError}>{favoritesError}</Text>
                <Text style={styles.retryText}>重试</Text>
              </TouchableOpacity>
            ) : null}
            {postsError ? (
              <TouchableOpacity style={styles.inlineRetry} onPress={loadUserPosts}>
                <Text style={styles.dataError}>{postsError}</Text>
                <Text style={styles.retryText}>重试</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>最近发布</Text>
            <TouchableOpacity onPress={() => router.push('/my-posts')}><Text style={styles.seeAll}>查看全部</Text></TouchableOpacity>
          </View>
          {recentPosts.length > 0 ? recentPosts.map((post) => (
            <TouchableOpacity key={post.id} style={styles.recentPostItem} onPress={() => router.push(`/post/${post.id}`)}>
              <Text numberOfLines={1} style={styles.recentPostContent}>{post.content}</Text>
              <Text style={styles.recentPostMeta}>{post.tags.length > 0 ? `#${post.tags.join(' #')}` : '社区帖子'}</Text>
            </TouchableOpacity>
          )) : postsLoading ? (
            <Text style={styles.emptySectionText}>正在加载发布记录...</Text>
          ) : postsError ? null : (
            <Text style={styles.emptySectionText}>还没有发布内容</Text>
          )}
        </View>

        {/* 功能菜单 */}
        <View style={styles.section}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={index} testID={`profile-menu-${item.action}`} style={styles.menuItem} onPress={() => handleMenuPress(item.action)} activeOpacity={0.7}>
              <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}><Ionicons name={item.icon as any} size={18} color={item.color} /></View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuCount}>{item.count}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
            </TouchableOpacity>
          ))}
        </View>

        {/* 成就进度 */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>成就进度</Text>
            <TouchableOpacity onPress={() => setShowAchievements(true)}><Text style={styles.seeAll}>查看全部</Text></TouchableOpacity>
          </View>
          <View style={styles.achievementCard}>
            {achievements.slice(0, 3).map((a) => (
              <View key={a.id} style={styles.achievementItem}>
                <Text style={styles.achievementIcon}>{a.icon}</Text>
                <View style={styles.achievementInfo}>
                  <Text style={styles.achievementName}>{a.name}</Text>
                  <View style={styles.progressBar}>
                    <LinearGradient colors={a.isUnlocked ? [Colors.success, Colors.success + 'CC'] : [Colors.primary, Colors.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.progressFill, { width: `${(a.progress / a.maxProgress) * 100}%` }]} />
                  </View>
                </View>
                <Text style={styles.achievementProgress}>{a.progress}/{a.maxProgress}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* 设置弹窗 */}
      <Modal visible={showSettings} animationType="slide" transparent onRequestClose={() => setShowSettings(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>设置</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.settingsList}>
              <View style={styles.settingGroup}>
                <Text style={styles.settingGroupTitle}>通知设置</Text>
                <View style={styles.settingItem}>
                  <View style={styles.settingLeft}><Ionicons name="notifications-outline" size={20} color={Colors.primary} /><Text style={styles.settingLabel}>推送通知</Text></View>
                  <Switch value={notificationsEnabled} onValueChange={(value) => handlePreferenceChange('notifications', value)} trackColor={{ false: Colors.border, true: Colors.primary + '40' }} thumbColor={notificationsEnabled ? Colors.primary : Colors.textLight} />
                </View>
              </View>
              <View style={styles.settingGroup}>
                <Text style={styles.settingGroupTitle}>显示设置</Text>
                <View style={styles.settingItem}>
                  <View style={styles.settingLeft}><Ionicons name="moon-outline" size={20} color={Colors.secondary} /><Text style={styles.settingLabel}>深色模式</Text></View>
                  <Switch value={darkModeEnabled} onValueChange={(value) => handlePreferenceChange('darkMode', value)} trackColor={{ false: Colors.border, true: Colors.secondary + '40' }} thumbColor={darkModeEnabled ? Colors.secondary : Colors.textLight} />
                </View>
                <View style={styles.settingItem}>
                  <View style={styles.settingLeft}><Ionicons name="play-outline" size={20} color={Colors.accent} /><Text style={styles.settingLabel}>自动播放视频</Text></View>
                  <Switch value={autoPlayVideo} onValueChange={(value) => handlePreferenceChange('autoPlayVideo', value)} trackColor={{ false: Colors.border, true: Colors.accent + '40' }} thumbColor={autoPlayVideo ? Colors.accent : Colors.textLight} />
                </View>
              </View>
              <View style={styles.settingGroup}>
                <Text style={styles.settingGroupTitle}>账号设置</Text>
                {[{ icon: 'person-outline' as const, label: '编辑资料' }, { icon: 'lock-closed-outline' as const, label: '修改密码' }, { icon: 'shield-outline' as const, label: '隐私设置' }].map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.settingItem}
                    onPress={() => {
                      if (s.label === '编辑资料') {
                        setShowSettings(false);
                        router.push('/profile-edit');
                        return;
                      }
                      Alert.alert('提示', `${s.label}功能即将完善`);
                    }}
                  >
                    <View style={styles.settingLeft}><Ionicons name={s.icon} size={20} color={Colors.text} /><Text style={styles.settingLabel}>{s.label}</Text></View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.settingGroup}>
                <Text style={styles.settingGroupTitle}>其他</Text>
                {[{ icon: 'help-circle-outline' as const, label: '帮助与反馈' }, { icon: 'information-circle-outline' as const, label: '关于我们' }, { icon: 'document-text-outline' as const, label: '用户协议' }].map((s, i) => (
                  <TouchableOpacity key={i} style={styles.settingItem}>
                    <View style={styles.settingLeft}><Ionicons name={s.icon} size={20} color={Colors.text} /><Text style={styles.settingLabel}>{s.label}</Text></View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.logoutBtn} onPress={() => { setShowSettings(false); onLogout(); }}>
                <Text style={styles.logoutText}>退出登录</Text>
              </TouchableOpacity>
              <Text style={styles.versionText}>版本 1.0.0</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 收藏列表弹窗 */}
      <Modal visible={showFavorites} animationType="slide" transparent onRequestClose={() => setShowFavorites(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>我的收藏</Text>
            <TouchableOpacity testID="profile-favorites-close" onPress={() => setShowFavorites(false)}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.favoritesList}>
              {favoritePosts.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  testID={`favorite-item-${item.postId}`}
                  style={styles.favoriteItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setShowFavorites(false);
                    router.push(`/post/${item.postId}`);
                  }}
                >
                  <View style={styles.favoriteIcon}><Text style={styles.favoriteEmoji}>{item.icon}</Text></View>
                  <View style={styles.favoriteInfo}>
                    <Text style={styles.favoriteTitle}>{item.title}</Text>
                    <Text style={styles.favoriteSubtitle}>{item.subtitle}</Text>
                  </View>
                  <View style={styles.favoriteTypeBadge}>
                    <Text style={styles.favoriteTypeText}>帖子</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {favoritePosts.length === 0 && (
                <View style={styles.emptyFavorites}>
                  <Text style={styles.favoriteSubtitle}>还没有收藏的帖子</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 成就系统弹窗 */}
      <Modal visible={showAchievements} animationType="slide" transparent onRequestClose={() => setShowAchievements(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>成就徽章</Text>
              <TouchableOpacity onPress={() => setShowAchievements(false)}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.achievementsList}>
              <View style={styles.achievementStats}>
                <View style={styles.achievementStatItem}><Text style={styles.achievementStatValue}>{achievements.filter((a) => a.isUnlocked).length}</Text><Text style={styles.achievementStatLabel}>已解锁</Text></View>
                <View style={styles.achievementStatDivider} />
                <View style={styles.achievementStatItem}><Text style={styles.achievementStatValue}>{achievements.filter((a) => !a.isUnlocked).length}</Text><Text style={styles.achievementStatLabel}>进行中</Text></View>
                <View style={styles.achievementStatDivider} />
                <View style={styles.achievementStatItem}><Text style={styles.achievementStatValue}>{achievements.length}</Text><Text style={styles.achievementStatLabel}>总成就</Text></View>
              </View>
              {achievements.map((a) => (
                <View key={a.id} style={[styles.achievementDetailItem, a.isUnlocked && styles.achievementDetailItemUnlocked]}>
                  <View style={styles.achievementDetailIcon}>
                    <Text style={styles.achievementDetailEmoji}>{a.icon}</Text>
                    {a.isUnlocked && <View style={styles.unlockedBadge}><Ionicons name="checkmark" size={10} color={Colors.surface} /></View>}
                  </View>
                  <View style={styles.achievementDetailInfo}>
                    <Text style={styles.achievementDetailName}>{a.name}</Text>
                    <Text style={styles.achievementDetailDesc}>{a.description}</Text>
                    <View style={styles.achievementDetailProgress}>
                      <View style={styles.progressBar}>
                        <LinearGradient colors={a.isUnlocked ? [Colors.success, Colors.success + 'CC'] : [Colors.primary, Colors.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.progressFill, { width: `${(a.progress / a.maxProgress) * 100}%` }]} />
                      </View>
                      <Text style={styles.achievementDetailProgressText}>{a.progress}/{a.maxProgress}</Text>
                    </View>
                  </View>
                  <View style={styles.achievementReward}>
                    <Ionicons name="gift-outline" size={14} color={Colors.secondary} />
                    <Text style={styles.achievementRewardText}>{a.reward}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ========== 主组件 ==========

export default function ProfilePage() {
  const { status, user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = useCallback(() => {
    Alert.alert('退出登录', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      { text: '确定', style: 'destructive', onPress: () => logout() },
    ]);
  }, [logout]);

  // 加载中状态
  if (status === 'idle' || status === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>个人中心</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>个人中心</Text>
        {status === 'authenticated' && (
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={22} color={Colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {status === 'authenticated' && user ? (
        <UserProfile user={user} onLogout={handleLogout} />
      ) : (
        <GuestProfile />
      )}

      {/* Settings modal for authenticated users rendered inside UserProfile */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  title: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  content: { paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Guest styles
  guestCard: { marginHorizontal: Spacing.xl, marginTop: Spacing.lg, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.lg },
  guestGradient: { alignItems: 'center', paddingVertical: Spacing.xxxl, paddingHorizontal: Spacing.xl },
  guestAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  guestTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  guestSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xl, textAlign: 'center' },
  loginBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxxl * 2,
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.xl,
    ...Shadows.md,
  },
  loginBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.surface },
  guestMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  guestMenuInfo: { flex: 1 },
  guestMenuDesc: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  // Authenticated styles
  profileCard: { alignItems: 'center', paddingVertical: Spacing.xxl },
  avatarGradient: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarText: { fontSize: 28, fontWeight: '700', color: Colors.primary },
  userName: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  levelBadge: { backgroundColor: Colors.primary + '20', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  levelText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  userMeta: { fontSize: FontSize.sm, color: Colors.textSecondary },
  userBio: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.sm },
  statsRow: { flexDirection: 'row', backgroundColor: Colors.surface, marginHorizontal: Spacing.xl, borderRadius: BorderRadius.lg, paddingVertical: Spacing.lg, ...Shadows.md },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  checkInCard: { marginHorizontal: Spacing.xl, marginTop: Spacing.lg, borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.sm },
  checkInCardDone: { opacity: 0.9 },
  checkInGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
  checkInLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  checkInInfo: {},
  checkInTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  checkInSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  checkInBtn: { backgroundColor: Colors.primary + '20', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.xl },
  checkInBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  expSection: { marginHorizontal: Spacing.xl, marginTop: Spacing.lg, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  expHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  expTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  expValue: { fontSize: FontSize.xs, color: Colors.textSecondary },
  expBar: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  expFill: { height: '100%', borderRadius: 4 },
  expHint: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: Spacing.sm },
  section: { marginTop: Spacing.xl, paddingHorizontal: Spacing.xl },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: '600', color: Colors.text, marginBottom: Spacing.md },
  seeAll: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '500' },
  petCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, ...Shadows.md },
  petAvatar: { marginRight: Spacing.md },
  petAvatarImage: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.background },
  petInfo: { flex: 1 },
  petName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  petBreed: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  petStats: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  petStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  petStatText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  enterBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.xl },
  enterBtnText: { fontSize: FontSize.sm, color: Colors.surface, fontWeight: '600' },
  dataRetry: { marginHorizontal: Spacing.xl, marginTop: Spacing.sm, backgroundColor: Colors.error + '08', borderRadius: BorderRadius.md, padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inlineRetry: { backgroundColor: Colors.error + '08', borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dataError: { flex: 1, fontSize: FontSize.sm, color: Colors.error },
  retryText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', marginLeft: Spacing.md },
  recentPostItem: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadows.sm },
  recentPostContent: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '500' },
  recentPostMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  emptySectionText: { fontSize: FontSize.sm, color: Colors.textSecondary, paddingVertical: Spacing.md, textAlign: 'center' },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadows.sm },
  menuIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  menuLabel: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  menuCount: { fontSize: FontSize.sm, color: Colors.textSecondary, marginRight: Spacing.sm },
  achievementCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.md, ...Shadows.sm },
  achievementItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  achievementIcon: { fontSize: 20, width: 28 },
  achievementInfo: { flex: 1 },
  achievementName: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '500', marginBottom: 4 },
  progressBar: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  achievementProgress: { fontSize: FontSize.xs, color: Colors.textSecondary, width: 40, textAlign: 'right' },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.xl, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  settingsList: { padding: Spacing.lg },
  settingGroup: { marginBottom: Spacing.xl },
  settingGroupTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  settingLabel: { fontSize: FontSize.md, color: Colors.text },
  logoutBtn: { marginTop: Spacing.xl, paddingVertical: Spacing.lg, backgroundColor: Colors.error + '10', borderRadius: BorderRadius.md, alignItems: 'center' },
  logoutText: { fontSize: FontSize.md, color: Colors.error, fontWeight: '600' },
  versionText: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.textLight, marginTop: Spacing.lg, marginBottom: Spacing.xxl },
  favoritesList: { padding: Spacing.lg },
  favoriteItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  favoriteIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  favoriteEmoji: { fontSize: 22 },
  favoriteInfo: { flex: 1 },
  favoriteTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  favoriteSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  favoriteTypeBadge: { backgroundColor: Colors.primary + '15', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  favoriteTypeText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '500' },
  emptyFavorites: { paddingVertical: Spacing.xl, alignItems: 'center' },
  achievementsList: { padding: Spacing.lg },
  achievementStats: { flexDirection: 'row', backgroundColor: Colors.background, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.xl },
  achievementStatItem: { flex: 1, alignItems: 'center' },
  achievementStatValue: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.primary },
  achievementStatLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  achievementStatDivider: { width: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  achievementDetailItem: { flexDirection: 'row', backgroundColor: Colors.background, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, alignItems: 'center' },
  achievementDetailItemUnlocked: { backgroundColor: Colors.success + '08', borderWidth: 1, borderColor: Colors.success + '30' },
  achievementDetailIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  achievementDetailEmoji: { fontSize: 24 },
  unlockedBadge: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.success, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.surface },
  achievementDetailInfo: { flex: 1 },
  achievementDetailName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  achievementDetailDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  achievementDetailProgress: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  achievementDetailProgressText: { fontSize: FontSize.xs, color: Colors.textSecondary, width: 40, textAlign: 'right' },
  achievementReward: { alignItems: 'center', marginLeft: Spacing.md },
  achievementRewardText: { fontSize: FontSize.xs, color: Colors.secondary, marginTop: 2 },
});
