import * as Storage from '../utils/storage';

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const publicBaseUrl = normalizeBaseUrl(
  configuredBaseUrl || (__DEV__ ? 'http://localhost:3000' : 'https://api.petplanet.app'),
);
const API_BASE_URL = `${publicBaseUrl}/api`;

const REFRESH_TOKEN_KEY = 'pet_planet_refresh_token';

interface RequestConfig extends RequestInit {
  url: string;
  params?: Record<string, string>;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<string> | null = null;
  private onAuthError: (() => void) | null = null;

  getAccessToken() {
    return this.accessToken;
  }

  /** 设置 Access Token (由 AuthContext 调用) */
  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  /** 注入认证失败回调 (由 AuthContext 调用) */
  setOnAuthError(callback: () => void) {
    this.onAuthError = callback;
  }

  /** 拼接查询参数 */
  private buildUrl(url: string, params?: Record<string, string>): string {
    const normalizedPath = normalizeApiPath(url);
    const fullUrl = normalizedPath.startsWith('http') ? normalizedPath : `${API_BASE_URL}${normalizedPath}`;
    if (!params || Object.keys(params).length === 0) return fullUrl;
    const qs = new URLSearchParams(params).toString();
    return `${fullUrl}?${qs}`;
  }

  /** 通用请求方法 */
  async request<T>(config: RequestConfig): Promise<T> {
    const { url, params, headers: customHeaders, ...rest } = config;
    const fullUrl = this.buildUrl(url, params);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(customHeaders as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(fullUrl, { headers, ...rest });

      if (response.status === 401) {
        // 尝试刷新 Token
        const newToken = await this.refreshAccessToken();
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(fullUrl, { headers, ...rest });
        if (!retryResponse.ok) {
          const errBody = await retryResponse.json().catch(() => ({}));
          throw new ApiError(
            errBody.message || '请求失败',
            retryResponse.status,
            errBody.code
          );
        }
        return retryResponse.json();
      }

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new ApiError(
          errBody.message || '请求失败',
          response.status,
          errBody.code
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('网络连接失败，请检查网络设置', 0);
    }
  }

  /** GET 请求 */
  async get<T>(url: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>({ url, method: 'GET', params });
  }

  /** POST 请求 */
  async post<T>(url: string, body?: unknown): Promise<T> {
    return this.request<T>({
      url,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /** PUT 请求 */
  async put<T>(url: string, body?: unknown): Promise<T> {
    return this.request<T>({
      url,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /** DELETE 请求 */
  async delete<T>(url: string): Promise<T> {
    return this.request<T>({ url, method: 'DELETE' });
  }

  /** 刷新 Access Token (并发安全) */
  async refreshAccessToken(): Promise<string> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async doRefresh(): Promise<string> {
    const refreshToken = await Storage.getItemAsync(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      this.onAuthError?.();
      throw new ApiError('登录已过期，请重新登录', 401);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        await Storage.deleteItemAsync(REFRESH_TOKEN_KEY);
        this.onAuthError?.();
        throw new ApiError('登录已过期，请重新登录', 401);
      }

      const result = await response.json();
      const { accessToken, refreshToken: newRefreshToken } = result.data;

      this.accessToken = accessToken;

      // 如果服务器轮转了 Refresh Token，更新本地存储
      if (newRefreshToken) {
        await Storage.setItemAsync(REFRESH_TOKEN_KEY, newRefreshToken);
      }

      return accessToken;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      await Storage.deleteItemAsync(REFRESH_TOKEN_KEY);
      this.onAuthError?.();
      throw new ApiError('登录已过期，请重新登录', 401);
    }
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function normalizeApiPath(url: string): string {
  if (url.startsWith('http')) return url;
  const withoutApiPrefix = url.startsWith('/api/') ? url.slice(4) : url === '/api' ? '/' : url;
  return withoutApiPrefix.startsWith('/') ? withoutApiPrefix : `/${withoutApiPrefix}`;
}

/** 自定义 API 错误类 */
export class ApiError extends Error {
  status: number;
  code?: number;

  constructor(message: string, status: number, code?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** 单例导出 */
export const apiClient = new ApiClient();
export const getApiBaseUrl = () => publicBaseUrl;
export const getApiAssetUrl = (path: string | null | undefined) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${publicBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};
