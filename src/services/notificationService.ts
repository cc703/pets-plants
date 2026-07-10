/**
 * 通知服务
 * 包含通知列表、标记已读、未读统计功能
 */

import { request } from './api';
import type { Notification, NotificationType } from '../types';
import { normalizeNotification } from './normalizers';

// ==================== Mock 数据（社区演示用） ====================

const mockFromUsers = [
  { id: 'u1', nickname: '猫奴小王', avatarUrl: '' },
  { id: 'u2', nickname: '养狗达人李姐', avatarUrl: '' },
  { id: 'u3', nickname: '金毛妈妈', avatarUrl: '' },
  { id: 'u4', nickname: '宠物摄影师', avatarUrl: '' },
  { id: 'u5', nickname: '新手铲屎官', avatarUrl: '' },
];

const mockNotifications: Notification[] = [
  { id: 'n1', type: 'like', fromUser: mockFromUsers[0], targetId: '1', targetTitle: '今天带小咪去体检啦', content: '赞了你的帖子', isRead: false, createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
  { id: 'n2', type: 'comment', fromUser: mockFromUsers[1], targetId: '1', targetTitle: '今天带小咪去体检啦', content: '评论了你的帖子', isRead: false, createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
  { id: 'n3', type: 'follow', fromUser: mockFromUsers[2], targetId: 'u3', content: '关注了你', isRead: false, createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  { id: 'n4', type: 'reply', fromUser: mockFromUsers[3], targetId: '2', targetTitle: '新手养柯基', content: '回复了你的评论', isRead: false, createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
];

let mockData = mockNotifications.map((n) => ({ ...n }));

// ==================== 时间格式化 ====================

export function formatNotificationTime(dateStr: string): string {
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

/** 获取通知列表（分页） */
export async function getNotifications(
  page: number = 1,
  pageSize: number = 10,
): Promise<{ data: Notification[]; total: number; page: number; hasMore: boolean }> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await request<{ code: number; data: any[]; total: number; page: number; hasMore: boolean }>(`/api/notifications?${params}`);
  return {
    data: (response.data || []).map(normalizeNotification),
    total: response.total || 0,
    page: response.page || page,
    hasMore: Boolean(response.hasMore),
  };
}

/** 获取未读通知数量 */
export async function getUnreadCount(): Promise<number> {
  const response = await request<{ code: number; data: number }>('/api/notifications/unread-count');
  return Number(response.data || 0);
}

/** 标记单条通知为已读 */
export async function markAsRead(notificationId: string): Promise<void> {
  await request(`/api/notifications/${notificationId}/read`, { method: 'POST' });
}

/** 全部标记已读 */
export async function markAllAsRead(): Promise<void> {
  await request('/api/notifications/read-all', { method: 'POST' });
}

/** 根据通知类型返回对应的图标名称 */
export function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case 'like':
      return 'heart';
    case 'comment':
      return 'chatbubble-ellipses';
    case 'reply':
      return 'arrow-undo';
    case 'follow':
      return 'person-add';
    case 'system':
      return 'megaphone';
    default:
      return 'notifications';
  }
}

/** 根据通知类型返回对应的颜色标签 */
export function getNotificationTypeLabel(type: NotificationType): string {
  switch (type) {
    case 'like':
      return '点赞';
    case 'comment':
      return '评论';
    case 'reply':
      return '回复';
    case 'follow':
      return '关注';
    case 'system':
      return '系统';
    default:
      return '';
  }
}
