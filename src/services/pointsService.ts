import { apiClient } from './apiClient';

interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}

export interface PointsSummary {
  points: number;
  totalEarned: number;
  checkedInToday: boolean;
  currentStreak: number;
}

export interface CheckInResult {
  streak: number;
  pointsEarned: number;
  message: string;
}

export interface PointsHistoryItem {
  id: string;
  amount: number;
  type: string;
  description: string;
  relatedId: string | null;
  createdAt: string;
}

export const pointsService = {
  async getSummary(): Promise<PointsSummary> {
    const res = await apiClient.get<ApiResponse<PointsSummary>>('/points/summary');
    return res.data;
  },

  async getTodayStatus(): Promise<{ checkedIn: boolean; streak: number; pointsEarned: number }> {
    const res = await apiClient.get<ApiResponse<{ checkedIn: boolean; streak: number; pointsEarned: number }>>('/points/today');
    return res.data;
  },

  async checkIn(): Promise<CheckInResult> {
    const res = await apiClient.post<ApiResponse<CheckInResult>>('/points/check-in');
    return res.data;
  },

  /** 消费积分 */
  async spendPoints(amount: number, description?: string): Promise<boolean> {
    await apiClient.post('/points/spend', { amount, description: description || `消费${amount}积分` });
    return true;
  },

  async getHistory(page: number = 1, limit: number = 20): Promise<{ data: PointsHistoryItem[]; pagination: any }> {
    const res = await apiClient.get<ApiResponse<PointsHistoryItem[]>>(`/points/history?page=${page}&limit=${limit}`);
    return { data: res.data, pagination: (res as any).pagination };
  },

  getTypeLabel(type: string): string {
    const map: Record<string, string> = {
      check_in: '每日签到',
      quiz: '答题奖励',
      post: '发布帖子',
      comment: '发表评论',
      like_received: '收到点赞',
      reward: '系统奖励',
      purchase: '积分消费',
    };
    return map[type] || type;
  },

  getTypeIcon(type: string): string {
    const map: Record<string, string> = {
      check_in: 'calendar',
      quiz: 'school',
      post: 'create',
      comment: 'chatbubble',
      like_received: 'heart',
      reward: 'gift',
      purchase: 'cart',
    };
    return map[type] || 'coin';
  },
};
