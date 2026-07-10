import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { QuizCategory, QuizRecord, LeaderboardEntry, QuizQuestion } from '../types';
import { quizzes, getRandomQuizzes } from '../data/quizzes';

// Mock 数据模式，使用 localStorage 存储
const RECORDS_KEY = 'pet_planet_quiz_records';
const POINTS_KEY = 'pet_planet_quiz_points';

/** 获取存储的答题记录 */
const getRecords = async (): Promise<QuizRecord[]> => {
  if (Platform.OS === 'web') {
    const data = localStorage.getItem(RECORDS_KEY);
    return data ? JSON.parse(data) : [];
  }
  const data = await AsyncStorage.getItem(RECORDS_KEY);
  return data ? JSON.parse(data) : [];
};

/** 保存答题记录 */
const saveRecords = async (records: QuizRecord[]) => {
  if (Platform.OS === 'web') {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    return;
  }
  await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(records));
};

/** 获取用户积分 */
export const getUserPoints = async (userId: string): Promise<number> => {
  if (Platform.OS === 'web') {
    const data = localStorage.getItem(POINTS_KEY);
    const pointsMap: Record<string, number> = data ? JSON.parse(data) : {};
    return pointsMap[userId] || 0;
  }
  const data = await AsyncStorage.getItem(POINTS_KEY);
  const pointsMap: Record<string, number> = data ? JSON.parse(data) : {};
  return pointsMap[userId] || 0;
};

/** 增加用户积分 */
export const addUserPoints = async (userId: string, points: number): Promise<number> => {
  if (Platform.OS === 'web') {
    const data = localStorage.getItem(POINTS_KEY);
    const pointsMap: Record<string, number> = data ? JSON.parse(data) : {};
    pointsMap[userId] = (pointsMap[userId] || 0) + points;
    localStorage.setItem(POINTS_KEY, JSON.stringify(pointsMap));
    return pointsMap[userId];
  }
  const data = await AsyncStorage.getItem(POINTS_KEY);
  const pointsMap: Record<string, number> = data ? JSON.parse(data) : {};
  pointsMap[userId] = (pointsMap[userId] || 0) + points;
  await AsyncStorage.setItem(POINTS_KEY, JSON.stringify(pointsMap));
  return pointsMap[userId];
};

/** 获取分类题目 */
export const getQuestionsByCategory = (category: QuizCategory): QuizQuestion[] => {
  return quizzes.filter(q => q.category === category);
};

/** 获取每日挑战题目（随机10题） */
export const getDailyChallengeQuestions = (): QuizQuestion[] => {
  return getRandomQuizzes(10);
};

/** 记录答题成绩 */
export const saveQuizRecord = async (
  userId: string,
  category: QuizCategory | 'daily',
  correctCount: number,
  totalQuestions: number,
  totalPoints: number,
  timeSpent: number
): Promise<QuizRecord> => {
  const record: QuizRecord = {
    id: `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    category,
    score: Math.round((correctCount / totalQuestions) * 100),
    totalQuestions,
    correctCount,
    totalPoints,
    timeSpent,
    completedAt: new Date().toISOString(),
  };

  const records = await getRecords();
  records.push(record);
  await saveRecords(records);

  // 增加用户积分
  await addUserPoints(userId, totalPoints);

  return record;
};

/** 获取用户答题记录 */
export const getUserQuizRecords = async (userId: string): Promise<QuizRecord[]> => {
  const records = await getRecords();
  return records.filter(r => r.userId === userId).sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
};

/** 获取用户答题统计 */
export const getUserQuizStats = async (userId: string) => {
  const records = await getUserQuizRecords(userId);
  const totalQuizzes = records.length;
  const totalCorrect = records.reduce((sum, r) => sum + r.correctCount, 0);
  const totalQuestions = records.reduce((sum, r) => sum + r.totalQuestions, 0);
  const totalPoints = await getUserPoints(userId);
  const correctRate = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  return {
    totalQuizzes,
    totalCorrect,
    totalQuestions,
    totalPoints,
    correctRate,
  };
};

/** 获取排行榜数据（Mock） */
export const getLeaderboard = (): LeaderboardEntry[] => {
  // 生成 Mock 排行榜数据
  const mockUsers: LeaderboardEntry[] = [
    { userId: 'mock-1', nickname: '宠物达人', avatarUrl: '', totalPoints: 2580, quizCount: 45, correctRate: 92 },
    { userId: 'mock-2', nickname: '猫咪爱好者', avatarUrl: '', totalPoints: 2150, quizCount: 38, correctRate: 88 },
    { userId: 'mock-3', nickname: '汪星人守护者', avatarUrl: '', totalPoints: 1890, quizCount: 32, correctRate: 85 },
    { userId: 'mock-4', nickname: '萌宠百科', avatarUrl: '', totalPoints: 1650, quizCount: 28, correctRate: 82 },
    { userId: 'mock-5', nickname: '铲屎官', avatarUrl: '', totalPoints: 1420, quizCount: 25, correctRate: 78 },
    { userId: 'mock-6', nickname: '小动物之友', avatarUrl: '', totalPoints: 1200, quizCount: 22, correctRate: 75 },
    { userId: 'mock-7', nickname: '毛茸茸控', avatarUrl: '', totalPoints: 980, quizCount: 18, correctRate: 72 },
    { userId: 'mock-8', nickname: '宠物新手', avatarUrl: '', totalPoints: 750, quizCount: 15, correctRate: 68 },
    { userId: 'mock-9', nickname: '爱宠人士', avatarUrl: '', totalPoints: 520, quizCount: 10, correctRate: 65 },
    { userId: 'mock-10', nickname: '小白铲屎官', avatarUrl: '', totalPoints: 300, quizCount: 6, correctRate: 60 },
  ];

  return mockUsers;
};

/** 获取用户在排行榜中的排名 */
export const getUserRank = (userId: string): number => {
  const leaderboard = getLeaderboard();
  // callers should prefer live leaderboard + async stats on native; this keeps current UI shape stable
  const userPoints = 0;

  // 找到用户应该排在第几位
  let rank = leaderboard.findIndex(entry => userPoints >= entry.totalPoints);
  if (rank === -1) {
    rank = leaderboard.length + 1;
  } else {
    rank += 1;
  }

  return rank;
};

/** 检查今日是否已完成每日挑战 */
export const hasCompletedDailyChallenge = async (userId: string): Promise<boolean> => {
  const records = await getUserQuizRecords(userId);
  const today = new Date().toDateString();

  return records.some(
    r => r.category === 'daily' && new Date(r.completedAt).toDateString() === today
  );
};
