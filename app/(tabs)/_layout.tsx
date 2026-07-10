import React, { useState, useEffect, useCallback } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, BorderRadius } from '../../src/utils/theme';
import { getUnreadCount } from '../../src/services/notificationService';
import { useAuth } from '../../src/contexts/AuthContext';

/** 未读角标组件 */
function NotificationBadge() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const loadCount = useCallback(async () => {
    if (!user) { setCount(0); return; }
    try {
      const n = await getUnreadCount();
      setCount(n);
    } catch {
      setCount(0);
    }
  }, [user]);

  useEffect(() => {
    loadCount();
    const timer = setInterval(loadCount, 30000);
    return () => clearInterval(timer);
  }, [loadCount]);

  if (count <= 0) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 60 + Math.max(insets.bottom, 12) : 64,
          paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 12) : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarButtonTestID: 'tab-home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: '社区',
          tabBarButtonTestID: 'tab-community',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="publish"
        options={{
          title: '发布',
          tabBarButtonTestID: 'tab-publish',
          tabBarIcon: ({ color, size }) => (
            <View style={styles.publishIcon}>
              <Ionicons name="add" size={size} color={Colors.surface} />
            </View>
          ),
          tabBarLabelStyle: {
            fontSize: FontSize.xs,
            fontWeight: '700',
            color: Colors.primary,
          },
        }}
      />
      <Tabs.Screen
        name="wiki"
        options={{
          title: '百科',
          tabBarButtonTestID: 'tab-wiki',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarButtonTestID: 'tab-profile',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="person" size={size} color={color} />
              <NotificationBadge />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="ai" options={{ href: null }} />
      <Tabs.Screen name="pet" options={{ href: null }} />
      <Tabs.Screen name="quiz" options={{ href: null }} />
      <Tabs.Screen name="notification" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.full,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },
  publishIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -4,
  },
});
