/** 宠物物种类型 */
export type Species = 'cat' | 'dog';

/** 性格特征维度键名 */
export type TemperamentKey = keyof Omit<BreedTemperament, 'keywords'>;

/** 品种性格特征 */
export interface BreedTemperament {
  energyLevel: number;      // 1-5 活泼度
  affectionLevel: number;   // 1-5 亲人度
  trainability: number;     // 1-5 训练难度
  intelligence: number;     // 1-5 智商
  sociability: number;      // 1-5 社交性
  vocalization: number;     // 1-5 叫声响亮程度
  keywords: string[];
}

export interface BreedAppearance {
  size: '小型' | '中型' | '大型' | '巨型';
  weightRange: { min: number; max: number };
  heightRange: { min: number; max: number };
  coatLength: '无毛' | '短毛' | '中毛' | '长毛';
  coatColors: string[];
  earShape: string;
  bodyShape: string;
}

export interface BreedCare {
  exerciseNeeds: '低' | '中' | '高' | '极高';
  groomingDifficulty: '简单' | '中等' | '困难' | '专业级';
  sheddingLevel: number; // 1-5
  lifespan: { min: number; max: number };
  commonDiseases: string[];
  dietaryNotes: string;
}

export interface Breed {
  id: string;
  name: string;
  nameEn: string;
  species: Species;
  originCountry: string;
  history: string;
  appearance: BreedAppearance;
  temperament: BreedTemperament;
  care: BreedCare;
  suitableFor: string[];
  funFacts: string[];
  imageUrl: string;
  gallery?: string[];
  voiceUrl?: string;
  popularityRank: number;
}

export interface VirtualPet {
  id: string;
  breedId: string;
  name: string;
  health: number;
  happiness: number;
  hunger: number;
  energy: number;
  cleanliness: number;
  level: number;
  experience: number;
  stage: '幼年' | '成年' | '老年';
  growth: { level: number; experience: number; nextLevelExp: number };
  stats: { happiness: number; hunger: number; energy: number; health: number };
}

/** 用户基础信息 */
export interface UserBasic {
  id: string;
  nickname: string;
  avatarUrl: string;
  level: number;
  bio: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  likeCount: number;
}

/** 社区帖子（完整版） */
export interface Post {
  id: string;
  user: UserBasic;
  content: string;
  images: string[];
  tags: string[];
  circleId?: string;
  location?: string;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  isLiked: boolean;
  isBookmarked: boolean;
  status: 'published' | 'pending' | 'rejected' | 'deleted';
  createdAt: string;
}

export interface BookmarkItem {
  id: string;
  postId: string;
  createdAt: string;
  targetTitle?: string;
  post: Post;
}

/** 评论（支持两级） */
export interface Comment {
  id: string;
  postId: string;
  user: UserBasic;
  parentId: string | null;
  replyToUser?: UserBasic;
  content: string;
  likeCount: number;
  isLiked: boolean;
  replies?: Comment[];
  replyCount: number;
  createdAt: string;
}

/** 社区帖子（旧版，保留兼容） */
export interface CommunityPost {
  id: string;
  user: string;
  level: number;
  time: string;
  content: string;
  likes: number;
  comments: number;
  tags: string[];
}

/** 社区圈子 */
export interface CommunityCircle {
  id: string;
  name: string;
  count: string;
  emoji: string;
}

/** AI 快捷功能 */
export interface QuickAction {
  icon: string;
  label: string;
  desc: string;
  color: string;
  bg: string;
}

/** 菜单项 */
export interface MenuItem {
  icon: string;
  label: string;
  count: string;
  color: string;
}

/** 通知类型 */
export type NotificationType = 'like' | 'comment' | 'follow' | 'reply' | 'system';

/** 通知消息 */
export interface Notification {
  id: string;
  type: NotificationType;
  fromUser: { id: string; nickname: string; avatarUrl: string };
  targetId: string; // 帖子/评论ID
  targetTitle?: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

/** 答题分类 */
export type QuizCategory = 'breed' | 'health' | 'behavior' | 'funfact';

/** 答题难度 */
export type QuizDifficulty = 'easy' | 'medium' | 'hard';

/** 题目 */
export interface QuizQuestion {
  id: string;
  category: QuizCategory;
  difficulty: QuizDifficulty;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  points: number;
}

/** 答题记录 */
export interface QuizRecord {
  id: string;
  userId: string;
  category: QuizCategory | 'daily';
  score: number;
  totalQuestions: number;
  correctCount: number;
  totalPoints: number;
  timeSpent: number;
  completedAt: string;
}

/** 排行榜条目 */
export interface LeaderboardEntry {
  userId: string;
  nickname: string;
  avatarUrl: string;
  totalPoints: number;
  quizCount: number;
  correctRate: number;
}

/** 用户信息 */
export interface User {
  id: string;
  username: string;
  nickname: string;
  avatarUrl: string | null;
  phone: string | null;
  email: string | null;
  bio: string;
  level: number;
  points: number;
  createdAt: string;
}
