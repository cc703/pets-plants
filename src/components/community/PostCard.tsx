/**
 * 帖子卡片组件
 * 展示帖子头部、内容、图片、标签、操作栏
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../utils/theme';
import ImageGrid from './ImageGrid';
import { formatTime } from '../../services/postService';
import type { Post } from '../../types';

interface PostCardProps {
  post: Post;
  onPress?: (post: Post) => void;
  onLike?: (post: Post) => void;
  onBookmark?: (post: Post) => void;
  onComment?: (post: Post) => void;
  onUserPress?: (userId: string) => void;
  onTagPress?: (tag: string) => void;
  showFullContent?: boolean;
}

const MAX_LINES = 3;

export default function PostCard({
  post,
  onPress,
  onLike,
  onBookmark,
  onComment,
  onUserPress,
  onTagPress,
  showFullContent = false,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(showFullContent);
  const [textTruncated, setTextTruncated] = useState(false);
  const likeScale = useRef(new Animated.Value(1)).current;

  const getLevelColor = (level: number) => {
    if (level >= 15) return '#FFD93D';
    if (level >= 10) return Colors.accent;
    if (level >= 5) return Colors.secondary;
    return Colors.primary;
  };

  const handleLike = useCallback(() => {
    onLike?.(post);
    Animated.sequence([
      Animated.timing(likeScale, {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: !Platform || Platform.OS !== 'web',
      }),
      Animated.timing(likeScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: !Platform || Platform.OS !== 'web',
      }),
    ]).start();
  }, [post, onLike, likeScale]);

  const handleTextLayout = useCallback(
    (e: { nativeEvent: { lines: unknown[] } }) => {
      if (!showFullContent && e.nativeEvent.lines.length > MAX_LINES) {
        setTextTruncated(true);
      }
    },
    [showFullContent],
  );

  const avatarEmoji =
    post.user.level >= 15 ? '🐕' : post.user.level >= 10 ? '🐶' : post.user.level >= 5 ? '😺' : '🐱';

  return (
    <TouchableOpacity
      testID={`post-card-${post.id}`}
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress?.(post)}
    >
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={() => onUserPress?.(post.user.id)}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <TouchableOpacity onPress={() => onUserPress?.(post.user.id)}>
              <Text style={styles.userName}>{post.user.nickname}</Text>
            </TouchableOpacity>
            <View
              style={[
                styles.levelBadge,
                { backgroundColor: getLevelColor(post.user.level) + '20' },
              ]}
            >
              <Text
                style={[
                  styles.levelText,
                  { color: getLevelColor(post.user.level) },
                ]}
              >
                Lv.{post.user.level}
              </Text>
            </View>
          </View>
          <Text style={styles.time}>{formatTime(post.createdAt)}</Text>
        </View>
        <TouchableOpacity style={styles.moreBtn}>
          <Ionicons
            name="ellipsis-horizontal"
            size={16}
            color={Colors.textLight}
          />
        </TouchableOpacity>
      </View>

      {/* 内容 */}
      {showFullContent ? (
        <Text style={styles.content}>{post.content}</Text>
      ) : (
        <Text
          style={styles.content}
          numberOfLines={expanded ? undefined : MAX_LINES}
          onTextLayout={handleTextLayout}
        >
          {post.content}
        </Text>
      )}
      {!showFullContent && textTruncated && !expanded && (
        <TouchableOpacity onPress={() => setExpanded(true)}>
          <Text style={styles.expandText}>展开全文</Text>
        </TouchableOpacity>
      )}

      {/* 图片 */}
      <ImageGrid images={post.images} />

      {/* 标签 */}
      {post.tags.length > 0 && (
        <View style={styles.tagRow}>
          {post.tags.map((tag, i) => (
            <TouchableOpacity
              key={i}
              style={styles.tag}
              onPress={() => onTagPress?.(tag)}
            >
              <Text style={styles.tagText}>#{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 操作栏 */}
      <View style={styles.actions}>
        <TouchableOpacity
          testID={`post-${post.id}-like-btn`}
          style={styles.actionBtn}
          onPress={handleLike}
          activeOpacity={0.7}
        >
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <Ionicons
              name={post.isLiked ? 'heart' : 'heart-outline'}
              size={18}
              color={post.isLiked ? Colors.accent : Colors.textSecondary}
            />
          </Animated.View>
          <Text
            style={[styles.actionText, post.isLiked && styles.actionTextActive]}
          >
            {post.likeCount > 0 ? post.likeCount : '赞'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID={`post-${post.id}-comment-btn`}
          style={styles.actionBtn}
          onPress={() => onComment?.(post)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chatbubble-outline"
            size={16}
            color={Colors.textSecondary}
          />
          <Text style={styles.actionText}>
            {post.commentCount > 0 ? post.commentCount : '评论'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID={`post-${post.id}-bookmark-btn`}
          style={styles.actionBtn}
          onPress={() => onBookmark?.(post)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={post.isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={16}
            color={post.isBookmarked ? Colors.secondary : Colors.textSecondary}
          />
          <Text
            style={[
              styles.actionText,
              post.isBookmarked && { color: Colors.secondary },
            ]}
          >
            {post.bookmarkCount > 0 ? post.bookmarkCount : '收藏'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarWrap: {
    marginRight: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 20,
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  userName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  levelText: {
    fontSize: 10,
    fontWeight: '700',
  },
  time: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  moreBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 22,
  },
  expandText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    marginTop: 4,
    fontWeight: '500',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  tag: {
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  tagText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  actions: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    gap: Spacing.xl,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  actionTextActive: {
    color: Colors.accent,
  },
});
