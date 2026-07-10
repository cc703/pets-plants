import { Platform } from 'react-native';
import { apiClient } from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from './authApi';

interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}

interface PointsSummary {
  points: number;
  totalEarned: number;
  checkedInToday: boolean;
  currentStreak: number;
}

interface CheckInResult {
  streak: number;
  pointsEarned: number;
  message: string;
}

interface PointsHistoryItem {
  id: string;
  amount: number;
  type: string;
  description: string;
  relatedId: string | null;
  createdAt: string;
}

// Local mock points storage (used when backend is unavailable)
const LOCAL_POINTS_KEY = 'pet_planet_points';
const LOCAL_CHECKIN_KEY = 'pet_planet_last_checkin';

let currentPointsUserKey = 'guest';

function getScopedKey(baseKey: string) {
  return `${baseKey}:${currentPointsUserKey}`;
}

const getLocalPoints = (): number => {
  if (Platform.OS !== 'web') return 0;
  return parseInt(localStorage.getItem(getScopedKey(LOCAL_POINTS_KEY)) || '0', 10);
};

const setLocalPoints = (pts: number) => {
  if (Platform.OS !== 'web') return;
  localStorage.setItem(getScopedKey(LOCAL_POINTS_KEY), String(pts));
};

const getLastCheckinDate = (): string => {
  if (Platform.OS !== 'web') return '';
  return localStorage.getItem(getScopedKey(LOCAL_CHECKIN_KEY)) || '';
};

const setLastCheckinDate = (date: string) => {
  if (Platform.OS !== 'web') return;
  localStorage.setItem(getScopedKey(LOCAL_CHECKIN_KEY), date);
};

async function getNativeValue(key: string): Promise<string> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(getScopedKey(key)) || '';
  }
  return (await AsyncStorage.getItem(getScopedKey(key))) || '';
}

async function setNativeValue(key: string, value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(getScopedKey(key), value);
    return;
  }
  await AsyncStorage.setItem(getScopedKey(key), value);
}

async function syncPointsUserKey() {
  try {
    const me = await authApi.getMe();
    currentPointsUserKey = me.id || 'guest';
  } catch {
    currentPointsUserKey = 'guest';
  }
}

const mockSummary: PointsSummary = { points: 0, totalEarned: 0, checkedInToday: false, currentStreak: 0 };

export const pointsService = {
  async getSummary(): Promise<PointsSummary> {
    try {
      const res = await apiClient.get<ApiResponse<PointsSummary>>('/points/summary');
      return res.data;
    } catch {
      await syncPointsUserKey();
      const points = getLocalPoints();
      const today = new Date().toDateString();
      const checkedInToday = getLastCheckinDate() === today;
      return { points, totalEarned: points, checkedInToday, currentStreak: checkedInToday ? 1 : 0 };
    }
  },

  async getTodayStatus(): Promise<{ checkedIn: boolean; streak: number; pointsEarned: number }> {
    try {
      const res = await apiClient.get<ApiResponse<{ checkedIn: boolean; streak: number; pointsEarned: number }>>('/points/today');
      return res.data;
    } catch {
      await syncPointsUserKey();
      const today = new Date().toDateString();
      const checkedIn = await getNativeValue(LOCAL_CHECKIN_KEY) === today;
      return { checkedIn, streak: checkedIn ? 1 : 0, pointsEarned: checkedIn ? 10 : 0 };
    }
  },

  async checkIn(): Promise<CheckInResult> {
    try {
      const res = await apiClient.post<ApiResponse<CheckInResult>>('/points/check-in');
      return res.data;
    } catch {
      await syncPointsUserKey();
      const today = new Date().toDateString();
      if (await getNativeValue(LOCAL_CHECKIN_KEY) === today) {
        return { streak: 1, pointsEarned: 0, message: '今日已签到' };
      }
      await setNativeValue(LOCAL_CHECKIN_KEY, today);
      const currentPoints = Number(await getNativeValue(LOCAL_POINTS_KEY) || '0');
      const newPts = currentPoints + 10;
      await setNativeValue(LOCAL_POINTS_KEY, String(newPts));
      return { streak: 1, pointsEarned: 10, message: '签到成功' };
    }
  },

  /** 增加积分 */
  async addPoints(amount: number, type: string = 'quiz', description?: string): Promise<void> {
    try {
      await apiClient.post('/points/earn', { amount, type, description: description || `获得${amount}积分` });
    } catch {
      await syncPointsUserKey();
      setLocalPoints(getLocalPoints() + amount);
    }
  },

  /** 消费积分 */
  async spendPoints(amount: number, description?: string): Promise<boolean> {
    try {
      await apiClient.post('/points/spend', { amount, description: description || `消费${amount}积分` });
      return true;
    } catch {
      await syncPointsUserKey();
      const current = getLocalPoints();
      if (current < amount) return false;
      setLocalPoints(current - amount);
      return true;
    }
  },

  async getHistory(page: number = 1, limit: number = 20): Promise<{ data: PointsHistoryItem[]; pagination: any }> {
    try {
      const res = await apiClient.get<ApiResponse<PointsHistoryItem[]>>(`/points/history?page=${page}&limit=${limit}`);
      return { data: res.data, pagination: (res as any).pagination };
    } catch {
      return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    }
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
