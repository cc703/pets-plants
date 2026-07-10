/**
 * 评论服务
 * 包含评论 CRUD、评论点赞功能
 */

import { request } from './api';
import type { Comment, UserBasic } from '../types';
import { normalizeComment } from './normalizers';

// ==================== Mock 数据 ====================

const mockUser1: UserBasic = { id: 'u1', nickname: '猫奴小王', avatarUrl: '', level: 8, bio: '', postCount: 28, followerCount: 1200, followingCount: 356, likeCount: 5600 };
const mockUser2: UserBasic = { id: 'u2', nickname: '养猫达人', avatarUrl: '', level: 10, bio: '', postCount: 56, followerCount: 3400, followingCount: 128, likeCount: 12000 };
const mockUser3: UserBasic = { id: 'u3', nickname: '猫咪医生', avatarUrl: '', level: 15, bio: '', postCount: 89, followerCount: 8900, followingCount: 200, likeCount: 34000 };
const mockUser4: UserBasic = { id: 'u4', nickname: '柯基爱好者', avatarUrl: '', level: 6, bio: '', postCount: 12, followerCount: 200, followingCount: 100, likeCount: 800 };
const mockUser5: UserBasic = { id: 'u5', nickname: '宠物摄影师', avatarUrl: '', level: 9, bio: '', postCount: 120, followerCount: 15000, followingCount: 500, likeCount: 56000 };
const mockUser6: UserBasic = { id: 'u6', nickname: '新手铲屎官', avatarUrl: '', level: 3, bio: '', postCount: 5, followerCount: 30, followingCount: 80, likeCount: 120 };

const mockCommentsData: Record<string, Comment[]> = {
  '1': [
    {
      id: 'c1',
      postId: '1',
      user: mockUser2,
      parentId: null,
      content: '建议定时定量喂食，一天两顿就好',
      likeCount: 12,
      isLiked: false,
      replyCount: 1,
      replies: [
        {
          id: 'c1r1',
          postId: '1',
          user: mockUser1,
          parentId: 'c1',
          replyToUser: mockUser2,
          content: '好的，谢谢建议！',
          likeCount: 3,
          isLiked: false,
          replyCount: 0,
          createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        },
      ],
      createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    },
    {
      id: 'c2',
      postId: '1',
      user: mockUser3,
      parentId: null,
      content: '可以试试处方粮，控制热量摄入。另外布偶猫容易有心脏病，建议每年做一次心脏超声。',
      likeCount: 25,
      isLiked: true,
      replyCount: 0,
      createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    },
  ],
  '2': [
    {
      id: 'c3',
      postId: '2',
      user: mockUser4,
      parentId: null,
      content: '太实用了！收藏了',
      likeCount: 8,
      isLiked: false,
      replyCount: 0,
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 'c4',
      postId: '2',
      user: mockUser6,
      parentId: null,
      content: '请问柯基掉毛真的很严重吗？我家沙发会不会全是毛？',
      likeCount: 5,
      isLiked: false,
      replyCount: 2,
      replies: [
        {
          id: 'c4r1',
          postId: '2',
          user: mockUser2,
          parentId: 'c4',
          replyToUser: mockUser6,
          content: '是的，换毛季特别严重，建议买个扫地机器人',
          likeCount: 3,
          isLiked: false,
          replyCount: 0,
          createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        },
        {
          id: 'c4r2',
          postId: '2',
          user: mockUser1,
          parentId: 'c4',
          replyToUser: mockUser6,
          content: '每天梳毛可以减少掉毛量',
          likeCount: 1,
          isLiked: false,
          replyCount: 0,
          createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        },
      ],
      createdAt: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    },
  ],
  '3': [
    {
      id: 'c5',
      postId: '3',
      user: mockUser5,
      parentId: null,
      content: '好可爱的金毛！可以约拍吗？',
      likeCount: 15,
      isLiked: false,
      replyCount: 0,
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'c6',
      postId: '3',
      user: mockUser6,
      parentId: null,
      content: '想养金毛了！请问好养吗？',
      likeCount: 8,
      isLiked: false,
      replyCount: 1,
      replies: [
        {
          id: 'c6r1',
          postId: '3',
          user: mockUser3,
          parentId: 'c6',
          replyToUser: mockUser6,
          content: '金毛很温顺，但需要大量运动，每天至少遛1小时',
          likeCount: 5,
          isLiked: false,
          replyCount: 0,
          createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        },
      ],
      createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    },
  ],
};

let commentsStore = JSON.parse(JSON.stringify(mockCommentsData)) as Record<string, Comment[]>;

// ==================== 服务方法 ====================

/** 获取帖子评论列表 */
export async function getComments(
  postId: string,
  page: number = 1,
  pageSize: number = 20,
  sort: 'latest' | 'hot' = 'latest',
): Promise<{ data: Comment[]; total: number; page: number }> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
    sort,
  });
  const response = await request<{ code: number; data: any[]; pagination?: { total?: number; page?: number } }>(`/api/posts/${postId}/comments?${params}`);
  return {
    data: (response.data || []).map(normalizeComment),
    total: response.pagination?.total || response.data?.length || 0,
    page: response.pagination?.page || page,
  };
}

/** 发表评论 */
export async function createComment(
  postId: string,
  data: {
    content: string;
    parentId?: string;
    replyToUserId?: string;
  },
): Promise<Comment> {
  const response = await request<{ code: number; data: any }>(`/api/posts/${postId}/comments`, {
    method: 'POST',
    body: data,
  });
  return normalizeComment(response.data);
}

/** 删除评论 */
export async function deleteComment(
  postId: string,
  commentId: string,
): Promise<void> {
  await request(`/api/comments/${commentId}`, { method: 'DELETE' });
}

/** 点赞/取消点赞评论 */
export async function toggleCommentLike(
  commentId: string,
): Promise<{ isLiked: boolean; likeCount: number }> {
  const response = await request<{ code: number; data: { liked?: boolean; isLiked?: boolean; likesCount?: number; likeCount?: number } }>(`/api/comments/${commentId}/like`, { method: 'POST' });
  return {
    isLiked: Boolean(response.data.isLiked ?? response.data.liked),
    likeCount: Number(response.data.likeCount ?? response.data.likesCount ?? 0),
  };
}
