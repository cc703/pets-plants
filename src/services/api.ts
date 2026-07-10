/**
 * API 请求封装
 * 统一复用 apiClient，避免出现多套 baseURL / 鉴权逻辑
 */

import { apiClient, getApiAssetUrl } from './apiClient';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
}

/** 统一请求方法 */
export async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;
  const normalizedEndpoint = endpoint.startsWith('/api/')
    ? endpoint.slice(4)
    : endpoint === '/api'
      ? '/'
      : endpoint;

  return apiClient.request<T>({
    url: normalizedEndpoint,
    method,
    headers,
    body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
  });
}

/** 上传图片（multipart/form-data） */
export async function uploadImage(uri: string): Promise<{ url: string }> {
  const formData = new FormData();
  const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
  formData.append('file', {
    uri,
    type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    name: `upload_${Date.now()}.${ext}`,
  } as unknown as Blob);

  const headers: Record<string, string> = {};
  const accessToken = apiClient.getAccessToken();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${getApiAssetUrl('/api/users/upload/image')}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as { message?: string }).message || '图片上传失败');
  }

  const result = await response.json();
  const rawUrl = result?.data?.url || result?.data?.avatarUrl;
  return { url: getApiAssetUrl(rawUrl) };
}
