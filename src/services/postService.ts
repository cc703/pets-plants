/**
 * 帖子服务
 * 包含帖子 CRUD、点赞、收藏功能
 */

import { request } from './api';
import type { BookmarkItem, Post, UserBasic } from '../types';
import { normalizePost } from './normalizers';

// ==================== Mock 数据 ====================

const mockUsers: UserBasic[] = [
  { id: 'u1', nickname: '猫奴小王', avatarUrl: 'https://cdn2.thecatapi.com/images/SCHe-SekW.jpg', level: 8, bio: '资深猫奴', postCount: 28, followerCount: 1200, followingCount: 356, likeCount: 5600 },
  { id: 'u2', nickname: '养狗达人李姐', avatarUrl: 'https://images.dog.ceo/breeds/corgi-cardigan/n02113186_6415.jpg', level: 12, bio: '10年养狗经验', postCount: 56, followerCount: 3400, followingCount: 128, likeCount: 12000 },
  { id: 'u3', nickname: '金毛妈妈', avatarUrl: 'https://images.dog.ceo/breeds/retriever-golden/n02099601_1028.jpg', level: 15, bio: '家有三只金毛', postCount: 89, followerCount: 8900, followingCount: 200, likeCount: 34000 },
  { id: 'u4', nickname: '宠物摄影师', avatarUrl: 'https://cdn2.thecatapi.com/images/y0wAin0Ei.jpg', level: 9, bio: '用镜头记录毛孩子', postCount: 120, followerCount: 15000, followingCount: 500, likeCount: 56000 },
  { id: 'u5', nickname: '新手铲屎官', avatarUrl: 'https://cdn2.thecatapi.com/images/mZZzMlywy.jpg', level: 3, bio: '刚入坑的小白', postCount: 5, followerCount: 30, followingCount: 80, likeCount: 120 },
];

const mockPosts: Post[] = [
  {
    id: '1',
    user: mockUsers[0],
    content: '今天带小咪去体检啦，一切正常！医生说布偶猫要注意控制体重，大家有什么好的喂食建议吗？',
    images: [
      'https://cdn2.thecatapi.com/images/y0wAin0Ei.jpg',
      'https://cdn2.thecatapi.com/images/nK0RaZbq3.jpg',
      'https://cdn2.thecatapi.com/images/Sy9SgPE0B.jpg',
    ],
    tags: ['布偶猫', '体检', '日常'],
    circleId: 'c1',
    likeCount: 128,
    commentCount: 12,
    bookmarkCount: 34,
    isLiked: false,
    isBookmarked: false,
    status: 'published',
    createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    user: mockUsers[1],
    content: '新手养柯基的十大注意事项！踩过的坑都在这了，建议收藏～\n\n1. 柯基腿短，不要让它频繁上下楼梯\n2. 容易发胖，一定要控制饮食\n3. 掉毛严重，准备好粘毛器\n4. 很爱叫，需要训练\n5. 需要大量运动，每天至少遛两次',
    images: [
      'https://images.dog.ceo/breeds/corgi-cardigan/n02113186_6415.jpg',
      'https://images.dog.ceo/breeds/corgi-cardigan/n02113186_3169.jpg',
      'https://images.dog.ceo/breeds/corgi-cardigan/n02113186_5242.jpg',
    ],
    tags: ['柯基', '新手攻略', '经验分享'],
    circleId: 'c3',
    likeCount: 256,
    commentCount: 45,
    bookmarkCount: 89,
    isLiked: false,
    isBookmarked: false,
    status: 'published',
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    user: mockUsers[2],
    content: '分享一下我家金毛的成长日记～从一个月大的小奶狗到现在的大暖男，每一步都充满了惊喜和感动！',
    images: [
      'https://images.dog.ceo/breeds/retriever-golden/n02099601_1028.jpg',
      'https://images.dog.ceo/breeds/retriever-golden/joey_20210805_130226.jpg',
      'https://images.dog.ceo/breeds/retriever-golden/n02099601_6814.jpg',
    ],
    tags: ['金毛', '成长日记', '治愈'],
    circleId: 'c4',
    likeCount: 512,
    commentCount: 67,
    bookmarkCount: 156,
    isLiked: true,
    isBookmarked: false,
    status: 'published',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    user: mockUsers[3],
    content: '周末给猫咪拍了一组写真，大家觉得哪张最好看？',
    images: [
      'https://cdn2.thecatapi.com/images/SCHe-SekW.jpg',
      'https://cdn2.thecatapi.com/images/8NdgktL3E.jpg',
      'https://cdn2.thecatapi.com/images/MuEGe1-Sz.jpg',
      'https://cdn2.thecatapi.com/images/GrPErz7EA.jpg',
    ],
    tags: ['猫咪写真', '摄影', '布偶猫'],
    circleId: 'c1',
    likeCount: 1024,
    commentCount: 89,
    bookmarkCount: 234,
    isLiked: false,
    isBookmarked: true,
    status: 'published',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    user: mockUsers[4],
    content: '第一次养猫，刚接回家的小橘一直躲在沙发底下不出来，正常吗？已经一天没吃东西了，好担心...',
    images: [
      'https://cdn2.thecatapi.com/images/BkksyH95Z.jpg',
    ],
    tags: ['新手求助', '橘猫', '应激反应'],
    circleId: 'c5',
    likeCount: 56,
    commentCount: 32,
    bookmarkCount: 8,
    isLiked: false,
    isBookmarked: false,
    status: 'published',
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '6',
    user: mockUsers[0],
    content: '英短今天终于肯在窗边晒太阳了，圆脸配小毯子真的太适合冬天。顺手记录一下猫砂盆和饮水机的位置调整，感觉它喝水明显变多了。',
    images: [
      'https://cdn2.thecatapi.com/images/GrPErz7EA.jpg',
      'https://cdn2.thecatapi.com/images/1bFFj7N5c.jpg',
    ],
    tags: ['英短', '晒太阳', '家养布置'],
    circleId: 'c2',
    likeCount: 342,
    commentCount: 28,
    bookmarkCount: 76,
    isLiked: false,
    isBookmarked: true,
    status: 'published',
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  },
  {
    id: '7',
    user: mockUsers[1],
    content: '哈士奇今天没有拆家，奖励一个鸡肉冻干。顺便测试了新的牵引绳，胸背受力更均匀，出门终于不用一路拔河了。',
    images: [
      'https://images.dog.ceo/breeds/husky/n02110185_12498.jpg',
      'https://images.dog.ceo/breeds/husky/n02110185_1164.jpg',
      'https://images.dog.ceo/breeds/husky/n02110185_8154.jpg',
    ],
    tags: ['哈士奇', '遛狗', '装备测评'],
    circleId: 'c6',
    likeCount: 418,
    commentCount: 51,
    bookmarkCount: 64,
    isLiked: true,
    isBookmarked: false,
    status: 'published',
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '8',
    user: mockUsers[3],
    content: '今天给一只布偶拍“朋友圈九宫格”，毛量太漂亮了。测试数据里先放 6 张，看看社区图片布局在宽屏和手机上是否都稳定。',
    images: [
      'https://cdn2.thecatapi.com/images/y0wAin0Ei.jpg',
      'https://cdn2.thecatapi.com/images/nK0RaZbq3.jpg',
      'https://cdn2.thecatapi.com/images/Sy9SgPE0B.jpg',
      'https://cdn2.thecatapi.com/images/OhTkBTPnD.jpg',
      'https://cdn2.thecatapi.com/images/DdmsQrCAv.jpg',
      'https://cdn2.thecatapi.com/images/BkksyH95Z.jpg',
    ],
    tags: ['布偶猫', '九宫格', '摄影'],
    circleId: 'c1',
    likeCount: 860,
    commentCount: 96,
    bookmarkCount: 188,
    isLiked: false,
    isBookmarked: false,
    status: 'published',
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '9',
    user: mockUsers[2],
    content: '金毛的定点等待训练第 7 天：从 5 秒进步到 40 秒。家里有小朋友的家庭，建议先训练“等待”和“松口”，日常会省心很多。',
    images: [
      'https://images.dog.ceo/breeds/retriever-golden/n02099601_6814.jpg',
    ],
    tags: ['金毛', '家庭训练', '有孩家庭'],
    circleId: 'c4',
    likeCount: 501,
    commentCount: 44,
    bookmarkCount: 131,
    isLiked: false,
    isBookmarked: true,
    status: 'published',
    createdAt: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '10',
    user: mockUsers[4],
    content: '小橘终于从沙发底下出来了！用了低声陪伴、固定饭点和纸箱安全屋，第二天开始主动蹭手。给同样新手的朋友一点信心。',
    images: [
      'https://cdn2.thecatapi.com/images/BkksyH95Z.jpg',
      'https://cdn2.thecatapi.com/images/DdmsQrCAv.jpg',
    ],
    tags: ['橘猫', '新手养猫', '应激恢复'],
    circleId: 'c5',
    likeCount: 229,
    commentCount: 37,
    bookmarkCount: 52,
    isLiked: false,
    isBookmarked: false,
    status: 'published',
    createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
  },
];

let mockPostsData = [...mockPosts];

const POSTS_REQUEST_TIMEOUT_MS = 3500;

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('帖子接口响应超时，使用本地测试数据')), ms);
  });
}

function getMockPosts(
  page: number,
  pageSize: number,
  sort: 'hot' | 'latest',
  circleId?: string,
): { data: Post[]; total: number; page: number } {
  const filtered = circleId
    ? mockPostsData.filter((post) => post.circleId === circleId)
    : [...mockPostsData];
  const sorted = filtered.sort((a, b) => {
    if (sort === 'latest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    const hotA = a.likeCount * 2 + a.commentCount * 3 + a.bookmarkCount;
    const hotB = b.likeCount * 2 + b.commentCount * 3 + b.bookmarkCount;
    return hotB - hotA;
  });
  const start = (page - 1) * pageSize;
  return {
    data: sorted.slice(start, start + pageSize),
    total: sorted.length,
    page,
  };
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
  try {
    const response = await Promise.race([
      request<{ code: number; data: any[]; pagination?: { total?: number; page?: number } }>(`/api/posts?${params}`),
      timeoutAfter(POSTS_REQUEST_TIMEOUT_MS),
    ]);
    const normalized = (response.data || []).map(normalizePost);
    if (normalized.length === 0 && page === 1) {
      return getMockPosts(page, pageSize, sort, circleId);
    }
    return {
      data: normalized,
      total: response.pagination?.total || response.data?.length || 0,
      page: response.pagination?.page || page,
    };
  } catch {
    return getMockPosts(page, pageSize, sort, circleId);
  }
}

/** 获取帖子详情 */
export async function getPostById(id: string): Promise<Post> {
  try {
    const response = await Promise.race([
      request<{ code: number; data: any }>(`/api/posts/${id}`),
      timeoutAfter(POSTS_REQUEST_TIMEOUT_MS),
    ]);
    return normalizePost(response.data);
  } catch {
    const post = mockPostsData.find((item) => item.id === id);
    if (post) return post;
    throw new Error('帖子不存在');
  }
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
