/**
 * 用户服务
 * 用户主页、关注、粉丝、成就
 */

import { request } from './api';
import type { UserBasic, Post } from '../types';
import { normalizePost, normalizeUserBasic } from './normalizers';
import { getUserQuizStats } from './quizService';

// ==================== Mock 数据 ====================

const mockUsers: Record<string, UserBasic> = {
  current_user: {
    id: 'current_user',
    nickname: '萌宠爱好者',
    avatarUrl: '',
    level: 5,
    bio: '热爱所有毛茸茸的小动物',
    postCount: 12,
    followerCount: 128,
    followingCount: 56,
    likeCount: 340,
  },
  u1: {
    id: 'u1',
    nickname: '猫奴小王',
    avatarUrl: '',
    level: 8,
    bio: '资深猫奴，家有三只主子',
    postCount: 28,
    followerCount: 1200,
    followingCount: 356,
    likeCount: 5600,
  },
  u2: {
    id: 'u2',
    nickname: '养狗达人李姐',
    avatarUrl: '',
    level: 12,
    bio: '10年养狗经验，专业训犬师',
    postCount: 56,
    followerCount: 3400,
    followingCount: 128,
    likeCount: 12000,
  },
  u3: {
    id: 'u3',
    nickname: '金毛妈妈',
    avatarUrl: '',
    level: 15,
    bio: '家有三只金毛，幸福满满',
    postCount: 89,
    followerCount: 8900,
    followingCount: 200,
    likeCount: 34000,
  },
};

const mockFollowers: string[] = ['u1', 'u2', 'u3'];
const mockFollowing: string[] = ['u1', 'u2'];

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  unlocked: boolean;
  isUnlocked: boolean;
  unlockedAt?: string;
  progress: number;
  maxProgress: number;
  reward: string;
}

const mockAchievements: Achievement[] = [
  { id: 'first_post', name: '初出茅庐', description: '发布第一篇帖子', icon: 'create-outline', color: '#4CAF50', unlocked: true, isUnlocked: true, unlockedAt: '2024-01-15', progress: 1, maxProgress: 1, reward: '100金币' },
  { id: 'first_pet', name: '铲屎官', description: '领养第一只虚拟宠物', icon: 'paw-outline', color: '#FF9800', unlocked: true, isUnlocked: true, unlockedAt: '2024-01-16', progress: 1, maxProgress: 1, reward: '100金币' },
  { id: 'quiz_master', name: '答题达人', description: '完成100道题目', icon: 'school-outline', color: '#2196F3', unlocked: true, isUnlocked: true, unlockedAt: '2024-02-01', progress: 100, maxProgress: 100, reward: '400金币' },
  { id: 'popular', name: '人气之星', description: '获得100个点赞', icon: 'star-outline', color: '#FFD700', unlocked: true, isUnlocked: true, unlockedAt: '2024-02-15', progress: 100, maxProgress: 100, reward: '300金币' },
  { id: 'social', name: '社交达人', description: '关注50个用户', icon: 'people-outline', color: '#9C27B0', unlocked: false, isUnlocked: false, progress: 0, maxProgress: 50, reward: '500金币' },
  { id: 'collector', name: '品种百科', description: '浏览所有品种', icon: 'book-outline', color: '#00BCD4', unlocked: false, isUnlocked: false, progress: 0, maxProgress: 50, reward: '300金币' },
  { id: 'influencer', name: '意见领袖', description: '获得1000个点赞', icon: 'trophy-outline', color: '#FF5722', unlocked: false, isUnlocked: false, progress: 0, maxProgress: 1000, reward: '800金币' },
  { id: 'veteran', name: '资深用户', description: '连续签到30天', icon: 'calendar-outline', color: '#795548', unlocked: false, isUnlocked: false, progress: 0, maxProgress: 30, reward: '500金币' },
];

// ==================== 服务方法 ====================

/** 获取用户信息 */
export async function getUserById(userId: string): Promise<UserBasic> {
  const response = await request<{ code: number; data: any }>(`/api/users/${userId}`);
  return normalizeUserBasic(response.data);
}

/** 获取用户帖子 */
export async function getUserPosts(
  userId: string,
  page: number = 1,
  pageSize: number = 10
): Promise<{ data: Post[]; total: number }> {
  const response = await request<{ code: number; data: any[]; pagination?: { total?: number } }>(
    `/api/users/${userId}/posts?page=${page}&pageSize=${pageSize}`,
  );
  return {
    data: (response.data || []).map(normalizePost),
    total: response.pagination?.total || response.data?.length || 0,
  };
}

/** 获取关注列表 */
export async function getFollowing(userId: string): Promise<UserBasic[]> {
  const response = await request<{ code: number; data: any[] }>(`/api/users/${userId}/following`);
  return (response.data || []).map(normalizeUserBasic);
}

/** 获取粉丝列表 */
export async function getFollowers(userId: string): Promise<UserBasic[]> {
  const response = await request<{ code: number; data: any[] }>(`/api/users/${userId}/followers`);
  return (response.data || []).map(normalizeUserBasic);
}

/** 关注/取消关注 */
export async function toggleFollow(userId: string): Promise<{ isFollowing: boolean }> {
  const response = await request<{ code: number; data: { isFollowing: boolean } }>(`/api/users/${userId}/follow`, { method: 'POST' });
  return response.data;
}

/** 检查关注状态 */
export async function checkFollowStatus(userId: string): Promise<{ isFollowing: boolean; isFollowedBy: boolean }> {
  const response = await request<{ code: number; data: { isFollowing: boolean; isFollowedBy: boolean } }>(`/api/users/${userId}/follow-status`);
  return response.data;
}

/** 获取成就列表 */
export async function getAchievements(user?: UserBasic | { id: string; postCount?: number; likeCount?: number }): Promise<Achievement[]> {
  const quizStats = user?.id ? await getUserQuizStats(user.id) : {
    totalQuizzes: 0,
    totalCorrect: 0,
    totalQuestions: 0,
    totalPoints: 0,
    correctRate: 0,
  };

  const posts = user?.postCount || 0;
  const likes = user?.likeCount || 0;

  return [
    {
      id: 'first_post',
      name: '初出茅庐',
      description: '发布第一篇帖子',
      icon: 'create-outline',
      color: '#4CAF50',
      unlocked: posts >= 1,
      isUnlocked: posts >= 1,
      progress: Math.min(posts, 1),
      maxProgress: 1,
      reward: '100金币',
    },
    {
      id: 'pet_caretaker',
      name: '铲屎官',
      description: '领养第一只虚拟宠物',
      icon: 'paw-outline',
      color: '#FF9800',
      unlocked: true,
      isUnlocked: true,
      progress: 1,
      maxProgress: 1,
      reward: '100金币',
    },
    {
      id: 'quiz_master',
      name: '答题达人',
      description: '完成50次答题',
      icon: 'school-outline',
      color: '#2196F3',
      unlocked: quizStats.totalQuizzes >= 50,
      isUnlocked: quizStats.totalQuizzes >= 50,
      progress: Math.min(quizStats.totalQuizzes, 50),
      maxProgress: 50,
      reward: '400金币',
    },
    {
      id: 'popular',
      name: '人气之星',
      description: '获得100个点赞',
      icon: 'star-outline',
      color: '#FFD700',
      unlocked: likes >= 100,
      isUnlocked: likes >= 100,
      progress: Math.min(likes, 100),
      maxProgress: 100,
      reward: '300金币',
    },
    {
      id: 'veteran',
      name: '活跃创作者',
      description: '发布10篇帖子',
      icon: 'trophy-outline',
      color: '#9C27B0',
      unlocked: posts >= 10,
      isUnlocked: posts >= 10,
      progress: Math.min(posts, 10),
      maxProgress: 10,
      reward: '500金币',
    },
  ];
}

/** 格式化数字 */
export function formatCount(count: number): string {
  if (count >= 10000) return (count / 10000).toFixed(1) + 'w';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
  return String(count);
}
