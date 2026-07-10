import type { Comment, Notification, Post, UserBasic } from '../types';
import { getApiAssetUrl } from './apiClient';

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toNumber(value: unknown, fallback: number = 0): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function normalizeAvatarUrl(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  return getApiAssetUrl(value);
}

export function normalizeUserBasic(raw: any): UserBasic {
  return {
    id: String(raw?.id ?? ''),
    nickname: raw?.nickname || raw?.username || '用户',
    avatarUrl: normalizeAvatarUrl(raw?.avatarUrl ?? raw?.avatar_url),
    level: toNumber(raw?.level, 1),
    bio: raw?.bio || '',
    postCount: toNumber(raw?.postCount ?? raw?.postsCount ?? raw?.posts_count),
    followerCount: toNumber(raw?.followerCount ?? raw?.followersCount ?? raw?.followers_count),
    followingCount: toNumber(raw?.followingCount ?? raw?.following_count),
    likeCount: toNumber(raw?.likeCount ?? raw?.likesCount ?? raw?.likes_count),
  };
}

export function normalizePost(raw: any): Post {
  const stats = raw?.stats || {};
  const images = parseJsonArray(raw?.images).map((image) => getApiAssetUrl(image));
  const tags = parseJsonArray(raw?.tags);

  return {
    id: String(raw?.id ?? ''),
    user: normalizeUserBasic(raw?.user ?? { id: raw?.userId ?? raw?.user_id }),
    content: raw?.content || '',
    images,
    tags,
    circleId: raw?.circleId ?? raw?.circle_id ?? undefined,
    location: raw?.location ?? undefined,
    likeCount: toNumber(raw?.likeCount ?? raw?.likesCount ?? raw?.likes_count ?? stats?.likesCount),
    commentCount: toNumber(raw?.commentCount ?? raw?.commentsCount ?? raw?.comments_count ?? stats?.commentsCount),
    bookmarkCount: toNumber(raw?.bookmarkCount ?? raw?.bookmarksCount ?? raw?.bookmark_count),
    isLiked: Boolean(raw?.isLiked ?? raw?.liked),
    isBookmarked: Boolean(raw?.isBookmarked ?? raw?.bookmarked),
    status: (raw?.status || 'published') as Post['status'],
    createdAt: raw?.createdAt || raw?.created_at || new Date().toISOString(),
  };
}

export function normalizeComment(raw: any): Comment {
  const replies = Array.isArray(raw?.replies)
    ? raw.replies.map(normalizeComment)
    : Array.isArray(raw?.children)
      ? raw.children.map(normalizeComment)
      : [];

  return {
    id: String(raw?.id ?? ''),
    postId: String(raw?.postId ?? raw?.post_id ?? ''),
    user: normalizeUserBasic(raw?.user ?? { id: raw?.userId ?? raw?.user_id }),
    parentId: raw?.parentId ?? raw?.parent_id ?? null,
    replyToUser: raw?.replyToUser ? normalizeUserBasic(raw.replyToUser) : undefined,
    content: raw?.content || '',
    likeCount: toNumber(raw?.likeCount ?? raw?.likesCount ?? raw?.likes_count),
    isLiked: Boolean(raw?.isLiked ?? raw?.liked),
    replies,
    replyCount: toNumber(raw?.replyCount ?? raw?.reply_count, replies.length),
    createdAt: raw?.createdAt || raw?.created_at || new Date().toISOString(),
  };
}

export function normalizeNotification(raw: any): Notification {
  return {
    id: String(raw?.id ?? ''),
    type: raw?.type || 'system',
    fromUser: normalizeUserBasic(raw?.fromUser ?? raw?.from_user ?? {
      id: raw?.from_user_id ?? 'system',
      nickname: raw?.from_nickname ?? '系统通知',
      avatarUrl: raw?.from_avatar ?? '',
    }),
    targetId: String(raw?.targetId ?? raw?.target_id ?? ''),
    targetTitle: raw?.targetTitle,
    content: raw?.content || '',
    isRead: Boolean(raw?.isRead ?? raw?.is_read),
    createdAt: raw?.createdAt || raw?.created_at || new Date().toISOString(),
  };
}

export function normalizeConversation(raw: any) {
  return {
    id: String(raw?.id ?? ''),
    user: normalizeUserBasic(raw?.user ?? raw?.peerUser ?? raw?.otherUser ?? {}),
    lastMessage: raw?.lastMessage ?? raw?.last_message ?? '',
    lastMessageType: (raw?.lastMessageType ?? raw?.last_message_type ?? 'text') as 'text' | 'image',
    unreadCount: toNumber(raw?.unreadCount ?? raw?.unread_count),
    updatedAt: raw?.updatedAt || raw?.lastMessageAt || raw?.last_message_at || raw?.createdAt || new Date().toISOString(),
  };
}

export function normalizeMessage(raw: any) {
  return {
    id: String(raw?.id ?? ''),
    conversationId: String(raw?.conversationId ?? raw?.conversation_id ?? ''),
    senderId: String(raw?.senderId ?? raw?.sender_id ?? ''),
    content: raw?.content || '',
    type: (raw?.type || 'text') as 'text' | 'image',
    isRead: Boolean(raw?.isRead ?? raw?.is_read),
    createdAt: raw?.createdAt || raw?.created_at || new Date().toISOString(),
  };
}
