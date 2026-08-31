import { apiClient, getApiAssetUrl } from './apiClient';

/** 用户信息 */
export interface User {
  id: string;
  username: string;
  nickname: string;
  avatarUrl: string | null;
  phone: string | null;
  email: string | null;
  emailVerifiedAt?: string | null;
  bio: string;
  level: number;
  points: number;
  createdAt: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  notifications: boolean;
  darkMode: boolean;
  autoPlayVideo: boolean;
  language: string;
}

/** 认证结果 (登录/注册成功后返回) */
export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface EmailCodeResult {
  expiresIn: number;
  debugCode?: string;
}

/** API 响应包装 */
interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}

function normalizeUser(raw: any): User {
  return {
    id: String(raw?.id ?? ''),
    username: raw?.username || '',
    nickname: raw?.nickname || raw?.username || '用户',
    avatarUrl: raw?.avatarUrl ? getApiAssetUrl(raw.avatarUrl) : null,
    phone: raw?.phone || null,
    email: raw?.email || null,
    emailVerifiedAt: raw?.emailVerifiedAt || raw?.email_verified_at || null,
    bio: raw?.bio || '',
    level: Number(raw?.level ?? 1),
    points: Number(raw?.points ?? 0),
    createdAt: raw?.createdAt || raw?.created_at || new Date().toISOString(),
    preferences: raw?.preferences || {
      notifications: true,
      darkMode: false,
      autoPlayVideo: true,
      language: 'zh-CN',
    },
  };
}

/** 登录参数 */
export interface LoginParams {
  method: 'password' | 'sms';
  username?: string;
  phone?: string;
  email?: string;
  password?: string;
  smsCode?: string;
}

/** 注册参数 */
export interface RegisterParams {
  method: 'phone' | 'email';
  username?: string;
  phone?: string;
  email?: string;
  password?: string;
  smsCode?: string;
  nickname?: string;
}

/** 重置密码参数 */
export interface ResetPasswordParams {
  method: 'phone' | 'email';
  phone?: string;
  email?: string;
  smsCode?: string;
  resetToken?: string;
  newPassword: string;
}

/** 更新资料参数 */
export interface UpdateProfileParams {
  nickname?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface UpdatePreferencesParams {
  notifications?: boolean;
  darkMode?: boolean;
  autoPlayVideo?: boolean;
  language?: string;
}

export interface ChangePasswordParams {
  oldPassword: string;
  newPassword: string;
}

// ==================== API 方法 ====================

export const authApi = {
  /** 密码登录 */
  async login(params: LoginParams): Promise<AuthResult> {
    const res = await apiClient.post<ApiResponse<AuthResult>>('/auth/login', {
      ...(params.email ? { email: params.email } : { username: params.username || params.phone }),
      password: params.password,
    });
    return {
      ...res.data,
      user: normalizeUser(res.data.user),
    };
  },

  /** 注册 */
  async register(params: RegisterParams): Promise<AuthResult> {
    const res = await apiClient.post<ApiResponse<AuthResult>>('/auth/register', {
      username: params.username || params.phone || params.email,
      password: params.password,
      nickname: params.nickname,
      phone: params.phone,
      email: params.email,
    });
    return {
      ...res.data,
      user: normalizeUser(res.data.user),
    };
  },

  /** 发送短信验证码 */
  async sendSmsCode(phone: string, type: 'login' | 'register' | 'reset'): Promise<{ expiresIn: number }> {
    const res = await apiClient.post<ApiResponse<{ expiresIn: number }>>('/auth/sms/send', { phone, type });
    return res.data;
  },

  /** 发送邮箱登录验证码 */
  async sendEmailLoginCode(email: string): Promise<EmailCodeResult> {
    const res = await apiClient.post<ApiResponse<EmailCodeResult>>('/auth/email/login-code/send', { email });
    return res.data;
  },

  /** 使用邮箱验证码登录 */
  async loginWithEmailCode(email: string, code: string): Promise<AuthResult> {
    const res = await apiClient.post<ApiResponse<AuthResult>>('/auth/email/login-code/login', { email, code });
    return {
      ...res.data,
      user: normalizeUser(res.data.user),
    };
  },

  /** 发送邮箱激活/验证邮件 */
  async sendEmailVerification(email: string): Promise<{ expiresIn: number }> {
    const res = await apiClient.post<ApiResponse<{ expiresIn: number }>>('/auth/email/verification/send', { email });
    return res.data;
  },

  /** 消费邮箱激活链接 */
  async verifyEmail(token: string): Promise<void> {
    await apiClient.get<ApiResponse<null>>(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  },

  /** 刷新 Token */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; user: User }> {
    const res = await apiClient.post<ApiResponse<{ accessToken: string; refreshToken?: string; user?: User }>>('/auth/refresh', { refreshToken });

    if (res.data.user) {
      return { accessToken: res.data.accessToken, user: normalizeUser(res.data.user) };
    }

    const me = await this.getMe();
    return { accessToken: res.data.accessToken, user: me };
  },

  /** 登出 */
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  /** 获取当前用户信息 */
  async getMe(): Promise<User> {
    const res = await apiClient.get<ApiResponse<User>>('/users/me');
    return normalizeUser(res.data);
  },

  /** 更新个人资料 */
  async updateProfile(params: UpdateProfileParams): Promise<User> {
    const res = await apiClient.put<ApiResponse<User>>('/users/me', params);
    return normalizeUser(res.data);
  },

  /** 更新偏好设置 */
  async updatePreferences(params: UpdatePreferencesParams): Promise<UpdatePreferencesParams> {
    const res = await apiClient.request<ApiResponse<UpdatePreferencesParams>>({
      url: '/users/me/preferences',
      method: 'PATCH',
      body: JSON.stringify(params),
    });
    return res.data;
  },

  /** 修改密码 */
  async changePassword(params: ChangePasswordParams): Promise<void> {
    await apiClient.put('/users/me/password', params);
  },

  /** 重置密码 */
  async resetPassword(params: ResetPasswordParams): Promise<void> {
    await apiClient.post('/auth/password/reset', params);
  },
};
