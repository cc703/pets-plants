/**
 * 帖子详情页
 * 展示帖子完整内容、评论列表、评论输入
 * 支持两级评论、点赞、收藏
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ensureLoggedIn, safeBack } from '../../src/utils/nav';
import { Colors, Spacing, BorderRadius, FontSize } from '../../src/utils/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { addBrowsingHistory } from '../../src/services/historyService';
import PostCard from '../../src/components/community/PostCard';
import CommentItem from '../../src/components/community/CommentItem';
import ReplyInput from '../../src/components/community/ReplyInput';
import {
  getPostById,
  toggleLike,
  toggleBookmark,
} from '../../src/services/postService';
import {
  getComments,
  createComment,
  toggleCommentLike,
} from '../../src/services/commentService';
import useInfiniteScroll from '../../src/hooks/useInfiniteScroll';
import type { Post, Comment } from '../../src/types';

export default function PostDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { status, user } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [postLoading, setPostLoading] = useState(true);
  const [commentSort, setCommentSort] = useState<'latest' | 'hot'>('latest');
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
    new Set(),
  );
  const [submitting, setSubmitting] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // 加载帖子详情
  useEffect(() => {
    if (!id) return;
    setPostLoading(true);
    getPostById(id)
      .then((loadedPost) => {
        setPost(loadedPost);
        addBrowsingHistory({
          type: 'post',
          targetId: loadedPost.id,
          title: loadedPost.content.slice(0, 24) || '帖子详情',
          subtitle: loadedPost.tags.length > 0 ? `#${loadedPost.tags.join(' #')}` : '社区帖子',
          icon: '📝',
        }, user?.id).catch(() => {});
      })
      .catch(() => Alert.alert('错误', '帖子不存在或已被删除'))
      .finally(() => setPostLoading(false));
  }, [id, user?.id]);

  // 加载评论
  const loadComments = useCallback(
    async (page: number, pageSize: number) => {
      if (!id) return [];
      const result = await getComments(id, page, pageSize, commentSort);
      return result.data;
    },
    [id, commentSort],
  );

  const {
    data: comments,
    loading: commentsLoading,
    hasMore,
    loadNextPage,
    refresh: refreshComments,
    setData: setCommentsData,
  } = useInfiniteScroll<Comment>({
    pageSize: 20,
    loadMore: loadComments,
  });

  // 切换评论排序（loadMore 变化会自动触发刷新）
  const handleSortChange = useCallback((sort: 'latest' | 'hot') => {
    setCommentSort(sort);
  }, []);

  // 帖子点赞
  const handlePostLike = useCallback(
    async (p: Post) => {
      if (!ensureLoggedIn(status === 'authenticated', '点赞')) return;
      const prev = { ...p };
      setPost((cur) =>
        cur
          ? {
              ...cur,
              isLiked: !cur.isLiked,
              likeCount: cur.isLiked
                ? cur.likeCount - 1
                : cur.likeCount + 1,
            }
          : cur,
      );
      try {
        await toggleLike(p.id);
      } catch {
        setPost((cur) =>
          cur
            ? {
                ...cur,
                isLiked: prev.isLiked,
                likeCount: prev.likeCount,
              }
            : cur,
        );
      }
    },
    [status],
  );

  // 帖子收藏
  const handlePostBookmark = useCallback(async (p: Post) => {
    if (!ensureLoggedIn(status === 'authenticated', '收藏')) return;
    const prev = { ...p };
    setPost((cur) =>
      cur
        ? { ...cur, isBookmarked: !cur.isBookmarked }
        : cur,
    );
    try {
      await toggleBookmark(p.id);
    } catch {
      setPost((cur) =>
        cur
          ? { ...cur, isBookmarked: prev.isBookmarked }
          : cur,
      );
    }
  }, [status]);

  // 评论点赞
  const handleCommentLike = useCallback(
    async (comment: Comment) => {
      if (!ensureLoggedIn(status === 'authenticated', '点赞评论')) return;
      const prevLiked = comment.isLiked;
      const prevCount = comment.likeCount;

      setCommentsData((prev) =>
        prev.map((c) => {
          if (c.id === comment.id) {
            return {
              ...c,
              isLiked: !c.isLiked,
              likeCount: c.isLiked ? c.likeCount - 1 : c.likeCount + 1,
            };
          }
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === comment.id
                  ? {
                      ...r,
                      isLiked: !r.isLiked,
                      likeCount: r.isLiked
                        ? r.likeCount - 1
                        : r.likeCount + 1,
                    }
                  : r,
              ),
            };
          }
          return c;
        }),
      );

      try {
        await toggleCommentLike(comment.id);
      } catch {
        setCommentsData((prev) =>
          prev.map((c) => {
            if (c.id === comment.id) {
              return { ...c, isLiked: prevLiked, likeCount: prevCount };
            }
            if (c.replies) {
              return {
                ...c,
                replies: c.replies.map((r) =>
                  r.id === comment.id
                    ? { ...r, isLiked: prevLiked, likeCount: prevCount }
                    : r,
                ),
              };
            }
            return c;
          }),
        );
      }
    },
    [setCommentsData, status],
  );

  // 回复评论
  const handleReply = useCallback((comment: Comment) => {
    if (!ensureLoggedIn(status === 'authenticated', '回复评论')) return;
    setReplyTo(comment);
  }, [status]);

  // 展开/折叠回复
  const toggleReplies = useCallback((commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  }, []);

  // 提交评论
  const handleSubmitComment = useCallback(async () => {
    if (!commentText.trim() || !id || submitting) return;
    if (!ensureLoggedIn(status === 'authenticated', '发表评论')) return;

    setSubmitting(true);
    try {
      const newComment = await createComment(id, {
        content: commentText.trim(),
        parentId: replyTo?.id,
        replyToUserId: replyTo?.user.id,
      });

      if (replyTo) {
        // 添加为二级评论
        setCommentsData((prev) =>
          prev.map((c) => {
            if (c.id === replyTo.id) {
              return {
                ...c,
                replies: [...(c.replies || []), newComment],
                replyCount: (c.replyCount || 0) + 1,
              };
            }
            return c;
          }),
        );
        // 自动展开回复
        setExpandedReplies((prev) => new Set([...prev, replyTo.id]));
      } else {
        // 添加为一级评论
        setCommentsData((prev) => [newComment, ...prev]);
      }

      // 更新帖子评论数
      setPost((cur) =>
        cur ? { ...cur, commentCount: cur.commentCount + 1 } : cur,
      );

      setCommentText('');
      setReplyTo(null);
    } catch {
      Alert.alert('错误', '评论发送失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }, [commentText, id, replyTo, submitting, setCommentsData, status]);

  if (postLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingWrap}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={Colors.textLight}
          />
          <Text style={styles.loadingText}>帖子不存在</Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => safeBack()}
          >
            <Text style={styles.backBtnText}>返回</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const placeholder = replyTo
    ? `回复 @${replyTo.user.nickname}...`
    : '写下你的评论...';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 顶部导航栏 */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navBack}
          onPress={() => safeBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>帖子详情</Text>
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navIcon}>
            <Ionicons
              name="share-outline"
              size={22}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navIcon}>
            <Ionicons
              name="ellipsis-horizontal"
              size={20}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.commentSection}>
              <CommentItem
                comment={item}
                onLike={handleCommentLike}
                onReply={handleReply}
                onUserPress={(userId) =>
                  router.push(`/user/${userId}`)
                }
              />
              {/* 展开回复按钮 */}
              {item.replyCount > 0 && !expandedReplies.has(item.id) && (
                <TouchableOpacity
                  style={styles.expandRepliesBtn}
                  onPress={() => toggleReplies(item.id)}
                >
                  <View style={styles.expandLine} />
                  <Text style={styles.expandRepliesText}>
                    展开 {item.replyCount} 条回复
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={14}
                    color={Colors.primary}
                  />
                </TouchableOpacity>
              )}
              {/* 二级回复列表 */}
              {expandedReplies.has(item.id) && item.replies && (
                <View style={styles.repliesWrap}>
                  {item.replies.map((reply: Comment) => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      isReply
                      onLike={handleCommentLike}
                      onUserPress={(userId) =>
                        router.push(`/user/${userId}`)
                      }
                    />
                  ))}
                  {item.replies.length < item.replyCount && (
                    <TouchableOpacity
                      style={styles.moreRepliesBtn}
                      onPress={() => toggleReplies(item.id)}
                    >
                      <Text style={styles.moreRepliesText}>
                        收起回复
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
          ListHeaderComponent={
            <View>
              {/* 帖子内容 */}
              <PostCard
                post={post}
                onLike={handlePostLike}
                onBookmark={handlePostBookmark}
                showFullContent
              />

              {/* 评论区标题 */}
              <View style={styles.commentHeader}>
                <Text style={styles.commentTitle}>
                  评论 ({post.commentCount})
                </Text>
                <View style={styles.sortRow}>
                  <TouchableOpacity
                    style={[
                      styles.sortBtn,
                      commentSort === 'latest' && styles.sortBtnActive,
                    ]}
                    onPress={() => handleSortChange('latest')}
                  >
                    <Text
                      style={[
                        styles.sortText,
                        commentSort === 'latest' && styles.sortTextActive,
                      ]}
                    >
                      最新
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.sortBtn,
                      commentSort === 'hot' && styles.sortBtnActive,
                    ]}
                    onPress={() => handleSortChange('hot')}
                  >
                    <Text
                      style={[
                        styles.sortText,
                        commentSort === 'hot' && styles.sortTextActive,
                      ]}
                    >
                      最热
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            commentsLoading ? (
              <View style={styles.emptyWrap}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <Ionicons
                  name="chatbubble-outline"
                  size={40}
                  color={Colors.textLight}
                />
                <Text style={styles.emptyText}>暂无评论，快来抢沙发！</Text>
              </View>
            )
          }
          ListFooterComponent={
            commentsLoading && comments.length > 0 ? (
              <View style={styles.footerLoad}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : !hasMore && comments.length > 0 ? (
              <Text style={styles.footerEnd}>-- 没有更多评论了 --</Text>
            ) : null
          }
          contentContainerStyle={styles.commentList}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (hasMore && !commentsLoading) loadNextPage();
          }}
          onEndReachedThreshold={0.3}
        />

        {/* 底部输入框 */}
        <ReplyInput
          placeholder={placeholder}
          value={commentText}
          onChangeText={(text) => {
            setCommentText(text);
            if (!text && replyTo) setReplyTo(null);
          }}
          onSubmit={handleSubmitComment}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.md,
  },
  backBtnText: {
    color: Colors.surface,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  navBack: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  navRight: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  navIcon: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentList: {
    paddingBottom: 20,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  commentTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  sortRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  sortBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
  },
  sortBtnActive: {
    backgroundColor: Colors.primary + '15',
  },
  sortText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  sortTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  commentSection: {
    paddingHorizontal: Spacing.xl,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  expandRepliesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 44,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  expandLine: {
    width: 20,
    height: 1,
    backgroundColor: Colors.primary,
  },
  expandRepliesText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '500',
  },
  repliesWrap: {
    marginLeft: Spacing.lg,
    borderLeftWidth: 2,
    borderLeftColor: Colors.primary + '20',
    paddingLeft: Spacing.sm,
  },
  moreRepliesBtn: {
    paddingVertical: Spacing.sm,
    paddingLeft: 44,
  },
  moreRepliesText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl * 2,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textLight,
  },
  footerLoad: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  footerEnd: {
    textAlign: 'center',
    paddingVertical: Spacing.xl,
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
});
