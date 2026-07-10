import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import * as Storage from '../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../services/authApi';
import { apiClient } from '../services/apiClient';
import type { ChangePasswordParams, User, LoginParams, RegisterParams, ResetPasswordParams, UpdatePreferencesParams, UpdateProfileParams } from '../services/authApi';

const REFRESH_TOKEN_KEY = 'pet_planet_refresh_token';
const USER_CACHE_KEY = 'pet_planet_user_cache';

// ---- 状态类型 ----

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  accessToken: string | null;
  error: string | null;
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; accessToken: string } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: Partial<User> }
  | { type: 'CLEAR_ERROR' }
  | { type: 'TOKEN_REFRESHED'; payload: string };

// ---- Context Value 类型 ----

export interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  loginWithPhone: (phone: string, password: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithSms: (phone: string, code: string) => Promise<void>;
  register: (params: RegisterParams) => Promise<void>;
  logout: () => Promise<void>;
  sendSmsCode: (phone: string, type: 'login' | 'register' | 'reset') => Promise<void>;
  resetPassword: (params: ResetPasswordParams) => Promise<void>;
  updateProfile: (params: UpdateProfileParams) => Promise<void>;
  updatePreferences: (params: UpdatePreferencesParams) => Promise<void>;
  changePassword: (params: ChangePasswordParams) => Promise<void>;
  clearError: () => void;
  refreshAccessToken: () => Promise<void>;
}

// ---- Reducer ----

const initialState: AuthState = {
  status: 'idle',
  user: null,
  accessToken: null,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, status: 'loading', error: null };
    case 'AUTH_SUCCESS':
      return {
        status: 'authenticated',
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        error: null,
      };
    case 'AUTH_FAILURE':
      return {
        status: 'unauthenticated',
        user: null,
        accessToken: null,
        error: action.payload || null,
      };
    case 'LOGOUT':
      return {
        status: 'unauthenticated',
        user: null,
        accessToken: null,
        error: null,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'TOKEN_REFRESHED':
      return { ...state, accessToken: action.payload };
    default:
      return state;
  }
}

// ---- Context ----

const AuthContext = createContext<AuthContextValue | null>(null);

// ---- Provider ----

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // 统一处理认证结果：存储 Token + 更新状态
  const handleAuthResult = useCallback(async (result: { user: User; accessToken: string; refreshToken: string }) => {
    try {
      await Storage.setItemAsync(REFRESH_TOKEN_KEY, result.refreshToken);
    } catch {
      // ignore
    }
    try {
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(result.user));
    } catch {
      // ignore
    }
    apiClient.setAccessToken(result.accessToken);
    dispatch({ type: 'AUTH_SUCCESS', payload: { user: result.user, accessToken: result.accessToken } });
  }, []);

  // 应用启动时恢复登录状态
  useEffect(() => {
    const restoreSession = async () => {
      dispatch({ type: 'AUTH_START' });
      try {
        const refreshToken = await Storage.getItemAsync(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          dispatch({ type: 'AUTH_FAILURE', payload: '' });
          return;
        }
        const { accessToken, user } = await authApi.refreshToken(refreshToken);
        apiClient.setAccessToken(accessToken);
        await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
        dispatch({ type: 'AUTH_SUCCESS', payload: { user, accessToken } });
      } catch {
        await Storage.deleteItemAsync(REFRESH_TOKEN_KEY);
        dispatch({ type: 'AUTH_FAILURE', payload: '' });
      }
    };
    restoreSession();
  }, []);

  // 注册认证失败回调，当 Token 刷新失败时自动登出
  useEffect(() => {
    apiClient.setOnAuthError(() => {
      Storage.deleteItemAsync(REFRESH_TOKEN_KEY);
      AsyncStorage.removeItem(USER_CACHE_KEY);
      apiClient.setAccessToken(null);
      dispatch({ type: 'LOGOUT' });
    });
  }, []);

  // ---- 认证方法 ----

  const login = useCallback(async (username: string, password: string) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const result = await authApi.login({ method: 'password', username, password });
      await handleAuthResult(result);
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE', payload: error.message || '登录失败' });
    }
  }, [handleAuthResult]);

  const loginWithPhone = useCallback(async (phone: string, password: string) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const result = await authApi.login({ method: 'password', phone, password });
      await handleAuthResult(result);
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE', payload: error.message || '登录失败' });
    }
  }, [handleAuthResult]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const result = await authApi.login({ method: 'password', email, password });
      await handleAuthResult(result);
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE', payload: error.message || '登录失败' });
    }
  }, [handleAuthResult]);

  const loginWithSms = useCallback(async (phone: string, code: string) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const result = await authApi.login({ method: 'sms', phone, smsCode: code });
      await handleAuthResult(result);
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE', payload: error.message || '登录失败' });
    }
  }, [handleAuthResult]);

  const register = useCallback(async (params: RegisterParams) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const result = await authApi.register(params);
      await handleAuthResult(result);
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE', payload: error.message || '注册失败' });
    }
  }, [handleAuthResult]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // 即使服务端登出失败，也要清除本地状态
    }
    await Storage.deleteItemAsync(REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(USER_CACHE_KEY);
    apiClient.setAccessToken(null);
    dispatch({ type: 'LOGOUT' });
  }, []);

  const sendSmsCode = useCallback(async (phone: string, type: 'login' | 'register' | 'reset') => {
    await authApi.sendSmsCode(phone, type);
  }, []);

  const resetPassword = useCallback(async (params: ResetPasswordParams) => {
    await authApi.resetPassword(params);
  }, []);

  const updateProfile = useCallback(async (params: UpdateProfileParams) => {
    try {
      const updatedUser = await authApi.updateProfile(params);
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(updatedUser));
      dispatch({ type: 'UPDATE_USER', payload: updatedUser });
    } catch (error: any) {
      throw new Error(error.message || '更新资料失败');
    }
  }, []);

  const updatePreferences = useCallback(async (params: UpdatePreferencesParams) => {
    try {
      const updatedPreferences = await authApi.updatePreferences(params);
      const nextUser = state.user
        ? {
            ...state.user,
            preferences: {
              ...(state.user.preferences || {
                notifications: true,
                darkMode: false,
                autoPlayVideo: true,
                language: 'zh-CN',
              }),
              ...updatedPreferences,
            },
          }
        : null;

      if (nextUser) {
        await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(nextUser));
        dispatch({ type: 'UPDATE_USER', payload: nextUser });
      }
    } catch (error: any) {
      throw new Error(error.message || '更新偏好失败');
    }
  }, [state.user]);

  const changePassword = useCallback(async (params: ChangePasswordParams) => {
    try {
      await authApi.changePassword(params);
    } catch (error: any) {
      throw new Error(error.message || '修改密码失败');
    }
  }, []);

  const refreshAccessToken = useCallback(async () => {
    try {
      const token = await apiClient.refreshAccessToken();
      dispatch({ type: 'TOKEN_REFRESHED', payload: token });
    } catch {
      // 刷新失败已在 apiClient 中触发 onAuthError
    }
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    loginWithPhone,
    loginWithEmail,
    loginWithSms,
    register,
    logout,
    sendSmsCode,
    resetPassword,
    updateProfile,
    updatePreferences,
    changePassword,
    clearError,
    refreshAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---- Hook ----

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
