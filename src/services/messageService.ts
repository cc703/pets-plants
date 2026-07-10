/**
 * 私信服务
 * 消息列表、聊天记录、发送消息
 */

import { request } from './api';
import type { UserBasic } from '../types';
import { normalizeConversation, normalizeMessage } from './normalizers';

export interface Conversation {
  id: string;
  user: UserBasic;
  lastMessage: string;
  lastMessageType: 'text' | 'image';
  unreadCount: number;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image';
  isRead: boolean;
  createdAt: string;
}

// ==================== 服务方法 ====================

/** 获取会话列表 */
export async function getConversations(): Promise<Conversation[]> {
  const response = await request<{ code: number; data: any[] }>('/api/messages/conversations');
  return (response.data || []).map(normalizeConversation);
}

/** 获取聊天记录 */
export async function getMessages(
  conversationId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ data: Message[]; hasMore: boolean }> {
  const response = await request<{ code: number; data: any[]; hasMore?: boolean; pagination?: { totalPages?: number; page?: number } }>(`/api/messages/${conversationId}?page=${page}&pageSize=${pageSize}`);
  return {
    data: (response.data || []).map(normalizeMessage),
    hasMore: Boolean(response.hasMore),
  };
}

/** 发送消息 */
export async function sendMessage(
  conversationId: string,
  content: string,
  type: 'text' | 'image' = 'text'
): Promise<Message> {
  const response = await request<{ code: number; data: any }>(`/api/messages/${conversationId}`, {
    method: 'POST',
    body: { content, type },
  });
  return normalizeMessage(response.data);
}

/** 创建会话 */
export async function createConversation(userId: string): Promise<Conversation> {
  const response = await request<{ code: number; data: any }>('/api/messages/conversations', {
    method: 'POST',
    body: { userId },
  });
  return normalizeConversation(response.data);
}

/** 标记已读 */
export async function markAsRead(conversationId: string): Promise<void> {
  await request(`/api/messages/${conversationId}/read`, { method: 'POST' });
}

/** 获取未读消息总数 */
export async function getUnreadCount(): Promise<number> {
  const response = await request<{ code: number; data: number }>('/api/messages/unread-count');
  return Number(response.data || 0);
}

/** 格式化时间 */
export function formatMessageTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}
