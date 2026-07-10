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

// ==================== Mock 数据 ====================

const mockCircles: Circle[] = [
  {
    id: 'c1',
    name: '猫咪乐园',
    description: '所有猫咪爱好者的聚集地，分享养猫日常、交流养护经验',
    emoji: '🐱',
    color: '#FF9800',
    memberCount: 12800,
    postCount: 3456,
    isJoined: true,
    createdAt: '2024-01-01',
  },
  {
    id: 'c2',
    name: '狗狗天地',
    description: '狗狗爱好者的家园，分享遛狗日常、训练技巧',
    emoji: '🐶',
    color: '#4CAF50',
    memberCount: 15600,
    postCount: 4567,
    isJoined: true,
    createdAt: '2024-01-01',
  },
  {
    id: 'c3',
    name: '布偶猫专区',
    description: '布偶猫爱好者的专属空间，分享布偶猫的美丽瞬间',
    emoji: '😺',
    color: '#E91E63',
    memberCount: 8900,
    postCount: 2345,
    isJoined: false,
    createdAt: '2024-01-15',
  },
  {
    id: 'c4',
    name: '金毛俱乐部',
    description: '金毛犬爱好者的俱乐部，分享金毛的成长故事',
    emoji: '🦮',
    color: '#FFD700',
    memberCount: 6700,
    postCount: 1890,
    isJoined: false,
    createdAt: '2024-02-01',
  },
  {
    id: 'c5',
    name: '新手铲屎官',
    description: '新手养宠指南，从零开始学习如何照顾毛孩子',
    emoji: '📖',
    color: '#2196F3',
    memberCount: 23400,
    postCount: 5678,
    isJoined: true,
    createdAt: '2024-01-10',
  },
  {
    id: 'c6',
    name: '宠物摄影',
    description: '用镜头记录毛孩子的美好瞬间，分享摄影技巧',
    emoji: '📸',
    color: '#9C27B0',
    memberCount: 4500,
    postCount: 1234,
    isJoined: false,
    createdAt: '2024-02-15',
  },
  {
    id: 'c7',
    name: '宠物健康',
    description: '宠物健康知识分享，疾病预防与护理经验',
    emoji: '💊',
    color: '#00BCD4',
    memberCount: 9800,
    postCount: 2890,
    isJoined: false,
    createdAt: '2024-01-20',
  },
  {
    id: 'c8',
    name: '流浪动物救助',
    description: '关注流浪动物，分享领养信息，传递爱心',
    emoji: '❤️',
    color: '#F44336',
    memberCount: 5600,
    postCount: 1567,
    isJoined: true,
    createdAt: '2024-02-10',
  },
];

let circlesData = [...mockCircles];

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
