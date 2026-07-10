import { Alert } from 'react-native';
import { router } from 'expo-router';

/** 安全返回：有历史则返回，否则跳转首页 */
export function safeBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/(tabs)');
  }
}

/** 需要登录时弹窗提示，返回 true 表示已登录可继续操作 */
export function requireLogin(feature?: string): boolean {
  Alert.alert(
    '提示',
    feature ? `${feature}需要登录后使用` : '此功能需要登录后使用',
    [
      { text: '取消', style: 'cancel' },
      { text: '去登录', onPress: () => router.push('/(auth)/login') },
    ],
  );
  return false;
}

export function ensureLoggedIn(isLoggedIn: boolean, feature?: string): boolean {
  if (isLoggedIn) return true;
  requireLogin(feature);
  return false;
}
