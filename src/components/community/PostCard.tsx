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
  Image,
  Dimensions,
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
const MEDIA_WIDTH = Dimensions.get('window').width - Spacing.xl * 2 - 52 - Spacing.md;

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

  const avatarInitial = post.user.nickname.trim().slice(0, 1) || '宠';

  return (
    <TouchableOpacity
      testID={`post-card-${post.id}`}
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress?.(post)}
    >
      <View style={styles.timelineRow}>
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={() => onUserPress?.(post.user.id)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`查看${post.user.nickname}的主页`}
        >
          {post.user.avatarUrl ? (
            <Image source={{ uri: post.user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: getLevelColor(post.user.level) + '18' }]}>
              <Text style={[styles.avatarInitial, { color: getLevelColor(post.user.level) }]}>{avatarInitial}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.momentBody}>
          {/* 头部 */}
          <View style={styles.header}>
            <View style={styles.userInfo}>
              <TouchableOpacity
                onPress={() => onUserPress?.(post.user.id)}
                accessibilityRole="button"
                accessibilityLabel={`查看${post.user.nickname}的主页`}
              >
                <Text style={styles.userName}>{post.user.nickname}</Text>
              </TouchableOpacity>
              <View style={styles.metaRow}>
                <Text style={styles.time}>{formatTime(post.createdAt)}</Text>
                <View style={styles.metaDot} />
                <Text style={styles.metaText}>Lv.{post.user.level}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.moreBtn}
              accessibilityRole="button"
              accessibilityLabel="更多动态操作"
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={17}
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
            <TouchableOpacity
              onPress={() => setExpanded(true)}
              accessibilityRole="button"
              accessibilityLabel="展开全文"
            >
              <Text style={styles.expandText}>展开全文</Text>
            </TouchableOpacity>
          )}

          {/* 图片 */}
          <ImageGrid images={post.images} maxWidth={MEDIA_WIDTH} />

          {/* 标签 */}
          {post.tags.length > 0 && (
            <View style={styles.tagRow}>
              {post.tags.map((tag, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.tag}
                  onPress={() => onTagPress?.(tag)}
                  accessibilityRole="button"
                  accessibilityLabel={`查看话题${tag}`}
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
              accessibilityRole="button"
              accessibilityLabel={post.isLiked ? '取消点赞' : '点赞'}
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
              accessibilityRole="button"
              accessibilityLabel="评论"
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
              accessibilityRole="button"
              accessibilityLabel={post.isBookmarked ? '取消收藏' : '收藏'}
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
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border + '80',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  avatarWrap: {
    marginRight: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
  },
  momentBody: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  time: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textLight,
  },
  metaText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  moreBtn: {
    width: 28,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  content: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 23,
  },
  expandText: {
    fontSize: FontSize.sm,
    color: Colors.primaryDark,
    marginTop: 4,
    fontWeight: '700',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  tag: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  tagText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: Spacing.sm,
    gap: Spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
  },
  actionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  actionTextActive: {
    color: Colors.accent,
  },
});
