/**
 * 圈子服务
 * 圈子列表、圈子详情、圈子帖子
 */

import { request } from './api';
import type { Post } from '../types';
import { normalizePost } from './normalizers';

export interface Circle {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  memberCount: number;
  postCount: number;
  isJoined: boolean;
  createdAt: string;
}

export type CircleMemberRole = 'member' | 'admin' | 'owner';

export interface CircleMember {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  level: number;
  role: CircleMemberRole;
  joinedAt: string;
}

// ==================== 服务方法 ====================

/** 获取圈子列表 */
export async function getCircles(): Promise<Circle[]> {
  const response = await request<{ code: number; data: Circle[] }>('/api/circles');
  return response.data || [];
}

/** 获取圈子详情 */
export async function getCircleById(circleId: string): Promise<Circle> {
  const response = await request<{ code: number; data: Circle }>(`/api/circles/${circleId}`);
  return response.data;
}

/** 加入/退出圈子 */
export async function toggleJoinCircle(circleId: string): Promise<{ isJoined: boolean }> {
  const response = await request<{ code: number; data: { isJoined: boolean } }>(`/api/circles/${circleId}/join`, { method: 'POST' });
  return response.data;
}

/** 获取圈子帖子 */
export async function getCirclePosts(
  circleId: string,
  page: number = 1,
  pageSize: number = 10,
  sort: 'hot' | 'latest' = 'hot'
): Promise<{ data: Post[]; total: number }> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
  });
  const response = await request<{ code: number; data: any[]; total?: number }>(`/api/circles/${circleId}/posts?${params}`);
  return {
    data: (response.data || []).map(normalizePost),
    total: response.total || response.data?.length || 0,
  };
}

/** 获取我加入的圈子 */
export async function getMyCircles(): Promise<Circle[]> {
  const response = await request<{ code: number; data: Circle[] }>('/api/circles/my');
  return response.data || [];
}

export async function getCircleMembers(circleId: string): Promise<{
  members: CircleMember[];
  currentUserRole: CircleMemberRole | null;
}> {
  const response = await request<{
    code: number;
    data: { members: CircleMember[]; currentUserRole: CircleMemberRole | null };
  }>(`/api/circles/${circleId}/members`);
  return response.data;
}

export async function createCircle(data: {
  name: string;
  description?: string;
  emoji?: string;
  color?: string;
}): Promise<Circle & { currentUserRole: CircleMemberRole }> {
  const response = await request<{ code: number; data: Circle & { currentUserRole: CircleMemberRole } }>('/api/circles', {
    method: 'POST',
    body: data,
  });
  return response.data;
}

export async function updateCircle(circleId: string, data: {
  name?: string;
  description?: string;
  emoji?: string;
  color?: string;
}): Promise<Circle & { currentUserRole: CircleMemberRole }> {
  const response = await request<{ code: number; data: Circle & { currentUserRole: CircleMemberRole } }>(`/api/circles/${circleId}`, {
    method: 'PUT',
    body: data,
  });
  return response.data;
}

export async function updateCircleMemberRole(circleId: string, userId: string, role: 'admin' | 'member'): Promise<{ userId: string; role: CircleMemberRole }> {
  const response = await request<{ code: number; data: { userId: string; role: CircleMemberRole } }>(`/api/circles/${circleId}/members/${userId}`, {
    method: 'PATCH',
    body: { role },
  });
  return response.data;
}

export async function removeCircleMember(circleId: string, userId: string): Promise<{ userId: string; removed: boolean }> {
  const response = await request<{ code: number; data: { userId: string; removed: boolean } }>(`/api/circles/${circleId}/members/${userId}`, {
    method: 'DELETE',
  });
  return response.data;
}

export async function transferCircleOwnership(circleId: string, userId: string): Promise<{
  circleId: string;
  previousOwnerId: string;
  ownerId: string;
}> {
  const response = await request<{ code: number; data: { circleId: string; previousOwnerId: string; ownerId: string } }>(`/api/circles/${circleId}/owner`, {
    method: 'PATCH',
    body: { userId },
  });
  return response.data;
}

export async function disbandCircle(circleId: string): Promise<{ circleId: string; deleted: boolean }> {
  const response = await request<{ code: number; data: { circleId: string; deleted: boolean } }>(`/api/circles/${circleId}`, {
    method: 'DELETE',
  });
  return response.data;
}
