import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading' || status === 'idle') return;

    const inAuthGroup = segments[0] === '(auth)';

    if (status === 'authenticated' && inAuthGroup) {
      // 已登录但在认证页面，跳转首页
      router.replace('/(tabs)');
    }
    // 未登录用户可以浏览大部分页面（游客模式），不需要强制跳转
    // 具体的登录拦截在需要认证的操作中处理
  }, [status, segments]);

  return <>{children}</>;
}
