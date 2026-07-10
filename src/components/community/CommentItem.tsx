/**
 * 单条评论组件
 * 支持一级评论和二级回复展示
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '../../utils/theme';
import { formatTime } from '../../services/postService';
import type { Comment } from '../../types';

interface CommentItemProps {
  comment: Comment;
  isReply?: boolean;
  onLike?: (comment: Comment) => void;
  onReply?: (comment: Comment) => void;
  onDelete?: (comment: Comment) => void;
  onUserPress?: (userId: string) => void;
}

export default function CommentItem({
  comment,
  isReply = false,
  onLike,
  onReply,
  onDelete,
  onUserPress,
}: CommentItemProps) {
  const likeScale = useRef(new Animated.Value(1)).current;

  const getLevelColor = (level: number) => {
    if (level >= 15) return '#FFD93D';
    if (level >= 10) return Colors.accent;
    if (level >= 5) return Colors.secondary;
    return Colors.primary;
  };

  const handleLike = useCallback(() => {
    onLike?.(comment);
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
  }, [comment, onLike, likeScale]);

  const avatarEmoji =
    comment.user.level >= 15
      ? '🐕'
      : comment.user.level >= 10
        ? '🐶'
        : comment.user.level >= 5
          ? '😺'
          : '🐱';

  return (
    <View style={[styles.container, isReply && styles.replyContainer]}>
      <TouchableOpacity
        style={styles.avatar}
        onPress={() => onUserPress?.(comment.user.id)}
      >
        <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => onUserPress?.(comment.user.id)}>
            <Text style={styles.userName}>{comment.user.nickname}</Text>
          </TouchableOpacity>
          <View
            style={[
              styles.levelBadge,
              { backgroundColor: getLevelColor(comment.user.level) + '20' },
            ]}
          >
            <Text
              style={[
                styles.levelText,
                { color: getLevelColor(comment.user.level) },
              ]}
            >
              Lv.{comment.user.level}
            </Text>
          </View>
          <Text style={styles.time}>{formatTime(comment.createdAt)}</Text>
        </View>

        <Text style={styles.text}>
          {comment.replyToUser && (
            <Text style={styles.replyTo}>
              回复 @{comment.replyToUser.nickname}：
            </Text>
          )}
          {comment.content}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleLike}
            activeOpacity={0.7}
          >
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Ionicons
                name={comment.isLiked ? 'heart' : 'heart-outline'}
                size={14}
                color={
                  comment.isLiked ? Colors.accent : Colors.textSecondary
                }
              />
            </Animated.View>
            <Text
              style={[
                styles.actionText,
                comment.isLiked && { color: Colors.accent },
              ]}
            >
              {comment.likeCount > 0 ? comment.likeCount : ''}
            </Text>
          </TouchableOpacity>

          {!isReply && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onReply?.(comment)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="chatbubble-outline"
                size={13}
                color={Colors.textSecondary}
              />
              <Text style={styles.actionText}>回复</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
  },
  replyContainer: {
    marginLeft: 44,
    paddingVertical: Spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  avatarEmoji: {
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  userName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  levelBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  levelText: {
    fontSize: 9,
    fontWeight: '700',
  },
  time: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginLeft: 'auto',
  },
  text: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 20,
  },
  replyTo: {
    color: Colors.primary,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  actionText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
});
