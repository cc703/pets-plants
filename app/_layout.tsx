import React, { useState, useCallback } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { Colors } from '../src/utils/theme';
import SplashScreenComponent from '../src/components/SplashScreen';
import ErrorBoundary from '../src/components/ErrorBoundary';
import NetworkBanner from '../src/components/NetworkBanner';
import useNetworkStatus from '../src/hooks/useNetworkStatus';
import { AuthProvider } from '../src/contexts/AuthContext';
import { PetProvider } from '../src/contexts/PetContext';
import AuthGuard from '../src/components/AuthGuard';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const { showBanner, hideBanner } = useNetworkStatus();

  const handleSplashFinish = useCallback(() => {
    setIsReady(true);
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <PetProvider>
        <AuthGuard>
          <StatusBar style="dark" />
          <NetworkBanner visible={showBanner} onDismiss={hideBanner} />
          {!isReady && <SplashScreenComponent onFinish={handleSplashFinish} />}
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.background },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="(auth)"
              options={{
                animation: 'slide_from_bottom',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="breed/[id]"
              options={{
                animation: 'slide_from_right',
              }}
            />
            {/* 社区子页面 */}
            <Stack.Screen
              name="post/[id]"
              options={{
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="post/create"
              options={{
                animation: 'slide_from_bottom',
                presentation: 'modal',
              }}
            />
            {/* 用户主页 */}
            <Stack.Screen
              name="user/[id]"
              options={{
                animation: 'slide_from_right',
              }}
            />
            {/* 宠物详情页 */}
            <Stack.Screen
              name="pet/[id]"
              options={{
                animation: 'slide_from_right',
              }}
            />
            {/* 圈子页面 */}
            <Stack.Screen
              name="circle/index"
              options={{
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="circle/[id]"
              options={{
                animation: 'slide_from_right',
              }}
            />
            {/* 答题页面 */}
            <Stack.Screen
              name="quiz/play"
              options={{
                animation: 'slide_from_right',
              }}
            />
            {/* 私信页面 */}
            <Stack.Screen
              name="message/index"
              options={{
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="message/[id]"
              options={{
                animation: 'slide_from_right',
              }}
            />
          </Stack>
        </AuthGuard>
        </PetProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
