/**
 * 帖子服务
 * 包含帖子 CRUD、点赞、收藏功能
 */

import { request } from './api';
import type { BookmarkItem, Post } from '../types';
import { normalizePost } from './normalizers';

const POSTS_REQUEST_TIMEOUT_MS = 3500;

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('帖子接口响应超时')), ms);
  });
}

// ==================== 时间格式化 ====================

export function formatTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`;
  if (diff < 24 * 60 * 60 * 1000)
    return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
  if (diff < 7 * 24 * 60 * 60 * 1000)
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

// ==================== 服务方法 ====================

/** 获取帖子列表 */
export async function getPosts(
  page: number = 1,
  pageSize: number = 10,
  sort: 'hot' | 'latest' = 'hot',
  circleId?: string,
): Promise<{ data: Post[]; total: number; page: number }> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
    sort,
    ...(circleId ? { circleId } : {}),
  });
  const response = await Promise.race([
    request<{ code: number; data: any[]; pagination?: { total?: number; page?: number } }>(`/api/posts?${params}`),
    timeoutAfter(POSTS_REQUEST_TIMEOUT_MS),
  ]);
  return {
    data: (response.data || []).map(normalizePost),
    total: response.pagination?.total || response.data?.length || 0,
    page: response.pagination?.page || page,
  };
}

/** 获取帖子详情 */
export async function getPostById(id: string): Promise<Post> {
  const response = await Promise.race([
    request<{ code: number; data: any }>(`/api/posts/${id}`),
    timeoutAfter(POSTS_REQUEST_TIMEOUT_MS),
  ]);
  return normalizePost(response.data);
}

/** 发布帖子 */
export async function createPost(data: {
  content: string;
  images?: string[];
  tags?: string[];
  circleId?: string;
}): Promise<Post> {
  const response = await request<{ code: number; data: any }>('/api/posts', { method: 'POST', body: data });
  return normalizePost(response.data);
}

/** 删除帖子 */
export async function deletePost(id: string): Promise<void> {
  await request(`/api/posts/${id}`, { method: 'DELETE' });
}

/** 点赞/取消点赞帖子 */
export async function toggleLike(
  id: string,
): Promise<{ isLiked: boolean; likeCount: number }> {
  const response = await request<{ code: number; data: { liked?: boolean; isLiked?: boolean; likesCount?: number; likeCount?: number } }>(`/api/posts/${id}/like`, { method: 'POST' });
  return {
    isLiked: Boolean(response.data.isLiked ?? response.data.liked),
    likeCount: Number(response.data.likeCount ?? response.data.likesCount ?? 0),
  };
}

/** 收藏/取消收藏帖子 */
export async function toggleBookmark(
  id: string,
): Promise<{ isBookmarked: boolean; bookmarkCount: number }> {
  const response = await request<{ code: number; data: { bookmarked?: boolean; isBookmarked?: boolean; bookmarkCount?: number; bookmarksCount?: number } }>(`/api/posts/${id}/bookmark`, { method: 'POST' });
  return {
    isBookmarked: Boolean(response.data.isBookmarked ?? response.data.bookmarked),
    bookmarkCount: Number(response.data.bookmarkCount ?? response.data.bookmarksCount ?? 0),
  };
}

/** 获取用户帖子列表 */
export async function getUserPosts(
  userId: string,
  page: number = 1,
  pageSize: number = 10,
): Promise<{ data: Post[]; total: number; page: number }> {
  const response = await request<{ code: number; data: any[]; pagination?: { total?: number; page?: number } }>(
    `/api/users/${userId}/posts?page=${page}&pageSize=${pageSize}`,
  );
  return {
    data: (response.data || []).map(normalizePost),
    total: response.pagination?.total || response.data?.length || 0,
    page: response.pagination?.page || page,
  };
}

/** 获取我的收藏 */
export async function getBookmarks(
  page: number = 1,
  limit: number = 20,
): Promise<{ data: BookmarkItem[]; total: number; page: number }> {
  const response = await request<{ code: number; data: any[]; pagination?: { total?: number; page?: number } }>(
    `/api/bookmarks?page=${page}&limit=${limit}`,
  );

  return {
    data: (response.data || []).map((item) => ({
      id: item.id,
      postId: item.postId,
      createdAt: item.createdAt,
      targetTitle: item.targetTitle,
      post: normalizePost(item.post),
    })),
    total: response.pagination?.total || response.data?.length || 0,
    page: response.pagination?.page || page,
  };
}
