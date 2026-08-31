/**
 * 圈子详情页
 * 展示圈子信息、帖子列表
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
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
  getCircleMembers,
  getCirclePosts,
  disbandCircle,
  removeCircleMember,
  transferCircleOwnership,
  toggleJoinCircle,
  updateCircle,
  updateCircleMemberRole,
  type Circle,
  type CircleMember,
  type CircleMemberRole,
} from '../../src/services/circleService';
import type { Post } from '../../src/types';

type SortType = 'hot' | 'latest';

function formatRole(role: string): string {
  if (role === 'owner') return '圈主';
  if (role === 'admin') return '管理员';
  return '成员';
}

export default function CircleDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { status, user } = useAuth();

  const [circle, setCircle] = useState<Circle | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [circleError, setCircleError] = useState<string | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const postsLoadingRef = useRef(false);
  const [sort, setSort] = useState<SortType>('hot');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<CircleMemberRole | null>(null);
  const [membersVisible, setMembersVisible] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberActionUserId, setMemberActionUserId] = useState<string | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editEmoji, setEditEmoji] = useState('🐾');
  const [editColor, setEditColor] = useState('#4CAF50');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // 加载圈子信息
  const loadCircle = useCallback(async () => {
    if (!id) return;
    setCircleError(null);
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
      setCircle(null);
      setCircleError(error instanceof Error && error.message.includes('不存在')
        ? '圈子不存在'
        : '圈子加载失败，请重试');
    }
  }, [id, user?.id]);

  const loadCurrentUserRole = useCallback(async () => {
    if (!id) return;
    try {
      const result = await getCircleMembers(id);
      setCurrentUserRole(result.currentUserRole);
    } catch {
      setCurrentUserRole(null);
    }
  }, [id]);

  // 加载帖子
  const loadPosts = useCallback(async (pageNum: number = 1, refresh: boolean = false) => {
    if (!id || postsLoadingRef.current) return;
    if (refresh) setPostsError(null);
    postsLoadingRef.current = true;
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
    } catch {
      setPostsError('帖子加载失败，请重试');
    } finally {
      postsLoadingRef.current = false;
      setPostsLoading(false);
    }
  }, [id, sort]);

  // 初始化
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadCircle(), loadPosts(1, true), loadCurrentUserRole()]);
      setLoading(false);
    };
    init();
  }, [loadCircle, loadCurrentUserRole]);

  // 排序变化时重新加载
  useEffect(() => {
    loadPosts(1, true);
  }, [sort, loadPosts]);

  // 下拉刷新
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadCircle(), loadPosts(1, true), loadCurrentUserRole()]);
    setRefreshing(false);
  }, [loadCircle, loadPosts, loadCurrentUserRole]);

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (!postsLoading && hasMore) {
      loadPosts(page + 1);
    }
  }, [postsLoading, hasMore, page, loadPosts]);

  // 加入/退出圈子
  const handleToggleJoin = useCallback(async () => {
    if (!id || !circle || joining) return;
    if (!ensureLoggedIn(status === 'authenticated', '加入圈子')) return;
    setJoining(true);
    setJoinError(null);
    try {
      const result = await toggleJoinCircle(id);
      setCircle((current) => current ? {
        ...current,
        isJoined: result.isJoined,
        memberCount: Math.max(0, result.isJoined ? current.memberCount + 1 : current.memberCount - 1),
      } : current);
    } catch {
      setJoinError('操作失败，请重试');
    } finally {
      setJoining(false);
    }
  }, [id, circle, joining, status]);

  const handleLoadMembers = useCallback(async () => {
    if (!id) return;
    setMembersVisible(true);
    setMembersLoading(true);
    setMembersError(null);
    try {
      const result = await getCircleMembers(id);
      setMembers(result.members);
      setCurrentUserRole(result.currentUserRole);
    } catch {
      setMembersError('成员加载失败，请重试');
    } finally {
      setMembersLoading(false);
    }
  }, [id]);

  const handleOpenEdit = useCallback(() => {
    if (!circle || currentUserRole !== 'owner') return;
    setEditName(circle.name);
    setEditDescription(circle.description);
    setEditEmoji(circle.emoji);
    setEditColor(circle.color);
    setEditError(null);
    setMembersVisible(false);
    setEditVisible(true);
  }, [circle, currentUserRole]);

  const handleMemberRole = useCallback(async (member: CircleMember) => {
    if (!id || currentUserRole !== 'owner' || member.role === 'owner' || memberActionUserId) return;
    const nextRole = member.role === 'admin' ? 'member' : 'admin';
    setMemberActionUserId(member.userId);
    setMembersError(null);
    try {
      await updateCircleMemberRole(id, member.userId, nextRole);
      await handleLoadMembers();
    } catch (error) {
      setMembersError(error instanceof Error ? error.message : '更新成员角色失败');
    } finally {
      setMemberActionUserId(null);
    }
  }, [currentUserRole, handleLoadMembers, id, memberActionUserId]);

  const handleRemoveMember = useCallback((member: CircleMember) => {
    if (!id || currentUserRole !== 'owner' || member.role === 'owner' || memberActionUserId) return;
    Alert.alert('移除成员', `确定移除“${member.nickname}”吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: async () => {
          setMemberActionUserId(member.userId);
          setMembersError(null);
          try {
            await removeCircleMember(id, member.userId);
            setMembers((current) => current.filter((item) => item.userId !== member.userId));
            setCircle((current) => current ? { ...current, memberCount: Math.max(0, current.memberCount - 1) } : current);
          } catch (error) {
            setMembersError(error instanceof Error ? error.message : '移除成员失败');
          } finally {
            setMemberActionUserId(null);
          }
        },
      },
    ]);
  }, [currentUserRole, id, memberActionUserId]);

  const handleTransferOwnership = useCallback((member: CircleMember) => {
    if (!id || currentUserRole !== 'owner' || member.role === 'owner' || memberActionUserId) return;
    Alert.alert('转让圈主', `确定将圈主转让给“${member.nickname}”吗？转让后你将变为普通成员。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认转让',
        style: 'destructive',
        onPress: async () => {
          setMemberActionUserId(member.userId);
          setMembersError(null);
          try {
            await transferCircleOwnership(id, member.userId);
            setCurrentUserRole('member');
            setMembers((current) => current.map((item) => (
              item.userId === member.userId
                ? { ...item, role: 'owner' }
                : item.userId === user?.id
                  ? { ...item, role: 'member' }
                  : item
            )));
          } catch (error) {
            setMembersError(error instanceof Error ? error.message : '转让圈主失败');
          } finally {
            setMemberActionUserId(null);
          }
        },
      },
    ]);
  }, [currentUserRole, id, memberActionUserId, user?.id]);

  const handleDisbandCircle = useCallback(() => {
    if (!id || currentUserRole !== 'owner' || memberActionUserId) return;
    Alert.alert('解散圈子', '解散后圈子将从公开列表隐藏，确认继续吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '解散',
        style: 'destructive',
        onPress: async () => {
          setMemberActionUserId('disband');
          setJoinError(null);
          try {
            await disbandCircle(id);
            router.back();
          } catch (error) {
            setJoinError(error instanceof Error ? error.message : '解散圈子失败');
          } finally {
            setMemberActionUserId(null);
          }
        },
      },
    ]);
  }, [currentUserRole, id, memberActionUserId, router]);

  const handleSubmitEdit = useCallback(async () => {
    if (!id || editSubmitting) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await updateCircle(id, {
        name: editName,
        description: editDescription,
        emoji: editEmoji,
        color: editColor,
      });
      setCircle(updated);
      setEditVisible(false);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : '保存失败，请重试');
    } finally {
      setEditSubmitting(false);
    }
  }, [id, editColor, editDescription, editEmoji, editName, editSubmitting]);

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
          <Text style={styles.errorText}>{circleError || '圈子不存在'}</Text>
          {circleError && circleError !== '圈子不存在' ? (
            <TouchableOpacity
              testID="circle-detail-retry-btn"
              style={styles.retryBtn}
              onPress={loadCircle}
              accessibilityRole="button"
              accessibilityLabel="重试加载圈子"
            >
              <Text style={styles.retryBtnText}>重试</Text>
            </TouchableOpacity>
          ) : null}
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
        {currentUserRole === 'owner' ? (
          <TouchableOpacity
            testID="circle-detail-edit-btn"
            style={styles.moreBtn}
            onPress={handleOpenEdit}
            accessibilityRole="button"
            accessibilityLabel="编辑圈子"
          >
            <Ionicons name="create-outline" size={20} color={Colors.text} />
          </TouchableOpacity>
        ) : <View style={styles.moreBtn} />}
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
              <Text testID="circle-detail-name" style={styles.circleName}>{circle.name}</Text>
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
                testID="circle-detail-members-btn"
                style={styles.membersBtn}
                onPress={handleLoadMembers}
                accessibilityRole="button"
                accessibilityLabel="查看圈子成员"
              >
                <Ionicons name="people-outline" size={16} color={Colors.primary} />
                <Text style={styles.membersBtnText}>查看成员</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="circle-detail-join-btn"
                style={[styles.joinBtn, circle.isJoined && styles.joinedBtn]}
                onPress={handleToggleJoin}
                disabled={joining || currentUserRole === 'owner'}
                activeOpacity={0.8}
              >
                {currentUserRole === 'owner' ? (
                  <>
                    <Ionicons name="shield-checkmark" size={16} color={Colors.surface} />
                    <Text style={[styles.joinBtnText, styles.joinedBtnText]}>圈主</Text>
                  </>
                ) : joining ? (
                  <ActivityIndicator size="small" color={circle.isJoined ? Colors.textSecondary : Colors.surface} />
                ) : (
                  <>
                    <Ionicons
                      name={circle.isJoined ? 'checkmark' : 'add'}
                      size={16}
                      color={circle.isJoined ? Colors.textSecondary : Colors.surface}
                    />
                    <Text style={[styles.joinBtnText, circle.isJoined && styles.joinedBtnText]}>
                      {circle.isJoined ? '已加入' : '加入圈子'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {joinError ? <Text style={styles.actionError}>{joinError}</Text> : null}
              {currentUserRole === 'owner' ? (
                <TouchableOpacity
                  testID="circle-detail-disband-btn"
                  style={styles.disbandBtn}
                  onPress={handleDisbandCircle}
                  disabled={memberActionUserId === 'disband'}
                  accessibilityRole="button"
                  accessibilityLabel="解散圈子"
                >
                  {memberActionUserId === 'disband' ? <ActivityIndicator size="small" color={Colors.accent} /> : <Text style={styles.disbandText}>解散圈子</Text>}
                </TouchableOpacity>
              ) : null}
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
          ) : postsError && posts.length > 0 ? (
            <View style={styles.inlineError}>
              <Text style={styles.inlineErrorText}>{postsError}</Text>
              <TouchableOpacity
                testID="circle-detail-posts-inline-retry-btn"
                onPress={() => loadPosts(page, false)}
                accessibilityRole="button"
                accessibilityLabel="重试加载更多帖子"
              >
                <Text style={styles.retryBtnText}>重试</Text>
              </TouchableOpacity>
            </View>
          ) : !hasMore && posts.length > 0 ? (
            <Text style={styles.noMoreText}>没有更多了</Text>
          ) : null
        }
        ListEmptyComponent={
          !postsLoading && postsError ? (
            <View style={styles.emptyState}>
              <Ionicons name="cloud-offline-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>{postsError}</Text>
              <TouchableOpacity
                testID="circle-detail-posts-retry-btn"
                style={styles.retryBtn}
                onPress={() => loadPosts(1, true)}
                accessibilityRole="button"
                accessibilityLabel="重试加载帖子"
              >
                <Text style={styles.retryBtnText}>重试</Text>
              </TouchableOpacity>
            </View>
          ) : !postsLoading ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>暂无帖子</Text>
              <Text style={styles.emptyHint}>快来发表第一篇帖子吧</Text>
            </View>
          ) : null
        }
      />

      {membersVisible ? (
        <View style={styles.membersPanel}>
          <View style={styles.membersHeader}>
            <Text style={styles.membersTitle}>圈子成员</Text>
            <TouchableOpacity
              testID="circle-detail-members-close-btn"
              onPress={() => setMembersVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="关闭成员列表"
            >
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {membersLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} style={styles.membersLoading} />
          ) : membersError ? (
            <View style={styles.membersEmpty}>
              <Text style={styles.membersError}>{membersError}</Text>
              <TouchableOpacity testID="circle-detail-members-retry-btn" onPress={handleLoadMembers}>
                <Text style={styles.retryBtnText}>重试</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={members}
              keyExtractor={(item) => item.userId}
              style={styles.membersList}
              ListEmptyComponent={<Text style={styles.membersEmptyText}>暂无成员</Text>}
              renderItem={({ item }) => (
                <View testID={`circle-member-${item.userId}`} style={styles.memberRow}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>{item.nickname.slice(0, 1)}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{item.nickname}</Text>
                    <Text style={styles.memberLevel}>Lv.{item.level}</Text>
                  </View>
                  <Text style={styles.roleText}>{formatRole(item.role)}</Text>
                  {currentUserRole === 'owner' && item.role !== 'owner' ? (
                    <View style={styles.memberActions}>
                      <TouchableOpacity
                        testID={`circle-member-role-${item.userId}`}
                        style={styles.memberActionBtn}
                        onPress={() => handleMemberRole(item)}
                        disabled={memberActionUserId === item.userId}
                        accessibilityRole="button"
                        accessibilityLabel={item.role === 'admin' ? '取消管理员' : '设为管理员'}
                      >
                        {memberActionUserId === item.userId ? (
                          <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                          <Text style={styles.memberActionText}>{item.role === 'admin' ? '降级' : '设管理员'}</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`circle-member-remove-${item.userId}`}
                        style={[styles.memberActionBtn, styles.memberRemoveBtn]}
                        onPress={() => handleRemoveMember(item)}
                        disabled={memberActionUserId === item.userId}
                        accessibilityRole="button"
                        accessibilityLabel="移除成员"
                      >
                        <Text style={styles.memberRemoveText}>移除</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`circle-member-transfer-${item.userId}`}
                        style={[styles.memberActionBtn, styles.memberTransferBtn]}
                        onPress={() => handleTransferOwnership(item)}
                        disabled={memberActionUserId === item.userId}
                        accessibilityRole="button"
                        accessibilityLabel="转让圈主"
                      >
                        <Text style={styles.memberTransferText}>转让</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              )}
            />
          )}
          {currentUserRole ? <Text style={styles.currentRoleText}>我的角色：{formatRole(currentUserRole)}</Text> : null}
        </View>
      ) : null}

      {editVisible ? (
        <View style={styles.editPanel}>
          <View style={styles.membersHeader}>
            <Text style={styles.membersTitle}>编辑圈子</Text>
            <TouchableOpacity
              testID="circle-detail-edit-close-btn"
              onPress={() => setEditVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="关闭编辑圈子"
            >
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <TextInput
            testID="circle-detail-edit-name-input"
            style={styles.editInput}
            value={editName}
            onChangeText={setEditName}
            placeholder="圈子名称"
            maxLength={30}
          />
          <TextInput
            testID="circle-detail-edit-description-input"
            style={[styles.editInput, styles.editDescriptionInput]}
            value={editDescription}
            onChangeText={setEditDescription}
            placeholder="圈子简介"
            multiline
            maxLength={200}
          />
          <View style={styles.editOptionsRow}>
            {['🐾', '🐶', '🐱', '🐰', '🐹', '🐥'].map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[styles.emojiOption, editEmoji === emoji && styles.emojiOptionActive]}
                onPress={() => setEditEmoji(emoji)}
              >
                <Text style={styles.emojiOptionText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.editOptionsRow}>
            {['#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0'].map((color) => (
              <TouchableOpacity
                key={color}
                style={[styles.colorOption, { backgroundColor: color }, editColor === color && styles.colorOptionActive]}
                onPress={() => setEditColor(color)}
                accessibilityLabel={`选择主题色 ${color}`}
              />
            ))}
          </View>
          {editError ? <Text style={styles.membersError}>{editError}</Text> : null}
          <TouchableOpacity
            testID="circle-detail-edit-submit-btn"
            style={styles.editSubmitBtn}
            onPress={handleSubmitEdit}
            disabled={editSubmitting}
          >
            {editSubmitting ? <ActivityIndicator size="small" color={Colors.surface} /> : <Text style={styles.editSubmitText}>保存修改</Text>}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 发帖按钮 */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          if (!ensureLoggedIn(status === 'authenticated', '发帖')) return;
          router.push(`/post/create?circleId=${encodeURIComponent(id)}`);
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
  retryBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
  },
  retryBtnText: { fontSize: FontSize.sm, color: Colors.surface, fontWeight: '600' },
  actionError: { marginTop: Spacing.sm, fontSize: FontSize.xs, color: Colors.accent },
  membersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary + '12',
  },
  membersBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  membersPanel: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.lg,
    maxHeight: '55%',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
  },
  editPanel: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
  },
  editInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.text,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
  editDescriptionInput: { minHeight: 72, textAlignVertical: 'top' },
  editOptionsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.xs },
  emojiOption: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.sm },
  emojiOptionActive: { backgroundColor: Colors.primary + '18' },
  emojiOptionText: { fontSize: 22 },
  colorOption: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: Colors.surface },
  colorOptionActive: { borderColor: Colors.text, borderWidth: 3 },
  editSubmitBtn: { alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, minHeight: 42 },
  editSubmitText: { color: Colors.surface, fontSize: FontSize.sm, fontWeight: '700' },
  membersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  membersTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  membersLoading: { paddingVertical: Spacing.xl },
  membersList: { maxHeight: 260 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { color: Colors.primary, fontWeight: '700' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600' },
  memberLevel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  roleText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginLeft: Spacing.xs },
  memberActionBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: BorderRadius.sm, backgroundColor: Colors.primary + '12', minWidth: 52, alignItems: 'center' },
  memberActionText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
  memberRemoveBtn: { backgroundColor: Colors.accent + '12' },
  memberRemoveText: { fontSize: FontSize.xs, color: Colors.accent, fontWeight: '600' },
  memberTransferBtn: { backgroundColor: Colors.warning + '18' },
  memberTransferText: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: '600' },
  currentRoleText: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.sm },
  membersEmpty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  membersEmptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.xl },
  membersError: { fontSize: FontSize.sm, color: Colors.accent },
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
  disbandBtn: { marginTop: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.accent + '55' },
  disbandText: { fontSize: FontSize.xs, color: Colors.accent, fontWeight: '600' },
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
  inlineError: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  inlineErrorText: { fontSize: FontSize.xs, color: Colors.accent },
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
