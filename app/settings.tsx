import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../src/utils/theme';
import { useAuth } from '../src/contexts/AuthContext';
import { safeBack } from '../src/utils/nav';

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout, updatePreferences } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [autoPlayVideo, setAutoPlayVideo] = useState(true);
  const [wifiOnlyImages, setWifiOnlyImages] = useState(false);

  useEffect(() => {
    if (!user) return;
    setNotificationsEnabled(user.preferences?.notifications ?? true);
    setDarkModeEnabled(user.preferences?.darkMode ?? false);
    setAutoPlayVideo(user.preferences?.autoPlayVideo ?? true);
  }, [user]);

  const handlePreferenceChange = async (
    key: 'notifications' | 'darkMode' | 'autoPlayVideo',
    value: boolean,
  ) => {
    try {
      if (key === 'notifications') setNotificationsEnabled(value);
      if (key === 'darkMode') setDarkModeEnabled(value);
      if (key === 'autoPlayVideo') setAutoPlayVideo(value);

      await updatePreferences({ [key]: value });
    } catch {
      Alert.alert('提示', '设置保存失败，请重试');
    }
  };

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      { text: '确定', style: 'destructive', onPress: () => { logout(); safeBack(); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>设置</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* 账号信息 */}
        {user && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>账号信息</Text>
            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push('/profile-edit')}>
              <View style={[styles.menuIcon, { backgroundColor: Colors.primary + '15' }]}>
                <Ionicons name="person-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.menuLabel}>编辑资料</Text>
              <Text style={styles.menuValue}>{user.nickname || user.username}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push('/change-password')}>
              <View style={[styles.menuIcon, { backgroundColor: Colors.secondary + '15' }]}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.secondary} />
              </View>
              <Text style={styles.menuLabel}>修改密码</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => Alert.alert('提示', '隐私设置功能即将完善')}>
              <View style={[styles.menuIcon, { backgroundColor: Colors.accent + '15' }]}>
                <Ionicons name="shield-outline" size={20} color={Colors.accent} />
              </View>
              <Text style={styles.menuLabel}>隐私设置</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
            </TouchableOpacity>
          </View>
        )}

        {/* 通知设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>通知设置</Text>
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#FF6B6B' + '15' }]}>
              <Ionicons name="notifications-outline" size={20} color="#FF6B6B" />
            </View>
            <Text style={styles.menuLabel}>推送通知</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={(value) => handlePreferenceChange('notifications', value)}
              trackColor={{ false: Colors.border, true: Colors.primary + '40' }}
              thumbColor={notificationsEnabled ? Colors.primary : Colors.textLight}
            />
          </View>
        </View>

        {/* 显示设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>显示设置</Text>
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: Colors.secondary + '15' }]}>
              <Ionicons name="moon-outline" size={20} color={Colors.secondary} />
            </View>
            <Text style={styles.menuLabel}>深色模式</Text>
            <Switch
              value={darkModeEnabled}
              onValueChange={(value) => handlePreferenceChange('darkMode', value)}
              trackColor={{ false: Colors.border, true: Colors.secondary + '40' }}
              thumbColor={darkModeEnabled ? Colors.secondary : Colors.textLight}
            />
          </View>
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: Colors.accent + '15' }]}>
              <Ionicons name="play-outline" size={20} color={Colors.accent} />
            </View>
            <Text style={styles.menuLabel}>自动播放视频</Text>
            <Switch
              value={autoPlayVideo}
              onValueChange={(value) => handlePreferenceChange('autoPlayVideo', value)}
              trackColor={{ false: Colors.border, true: Colors.accent + '40' }}
              thumbColor={autoPlayVideo ? Colors.accent : Colors.textLight}
            />
          </View>
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#4ECDC4' + '15' }]}>
              <Ionicons name="wifi-outline" size={20} color="#4ECDC4" />
            </View>
            <Text style={styles.menuLabel}>仅WiFi加载图片</Text>
            <Switch
              value={wifiOnlyImages}
              onValueChange={setWifiOnlyImages}
              trackColor={{ false: Colors.border, true: '#4ECDC4' + '40' }}
              thumbColor={wifiOnlyImages ? '#4ECDC4' : Colors.textLight}
            />
          </View>
        </View>

        {/* 缓存与存储 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>缓存与存储</Text>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => Alert.alert('提示', '缓存清理完成')}>
            <View style={[styles.menuIcon, { backgroundColor: '#9B5DE5' + '15' }]}>
              <Ionicons name="trash-outline" size={20} color="#9B5DE5" />
            </View>
            <Text style={styles.menuLabel}>清除缓存</Text>
            <Text style={styles.menuValue}>12.3 MB</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* 其他 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>其他</Text>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => Alert.alert('反馈', '请通过邮箱 feedback@petplanet.com 联系我们')}>
            <View style={[styles.menuIcon, { backgroundColor: Colors.primary + '15' }]}>
              <Ionicons name="help-circle-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.menuLabel}>帮助与反馈</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push('/about')}>
            <View style={[styles.menuIcon, { backgroundColor: Colors.textSecondary + '15' }]}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
            </View>
            <Text style={styles.menuLabel}>关于我们</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => Alert.alert('用户协议', '用户协议内容即将完善')}>
            <View style={[styles.menuIcon, { backgroundColor: Colors.textSecondary + '15' }]}>
              <Ionicons name="document-text-outline" size={20} color={Colors.textSecondary} />
            </View>
            <Text style={styles.menuLabel}>用户协议</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => Alert.alert('隐私政策', '隐私政策内容即将完善')}>
            <View style={[styles.menuIcon, { backgroundColor: Colors.textSecondary + '15' }]}>
              <Ionicons name="lock-open-outline" size={20} color={Colors.textSecondary} />
            </View>
            <Text style={styles.menuLabel}>隐私政策</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* 版本信息 */}
        <Text style={styles.versionText}>萌宠星球 v1.0.0</Text>

        {/* 退出登录 */}
        {user && (
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            <Text style={styles.logoutText}>退出登录</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  content: { flex: 1 },
  contentContainer: { paddingBottom: 100 },
  section: { marginTop: Spacing.lg, paddingHorizontal: Spacing.xl },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  menuIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  menuLabel: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  menuValue: { fontSize: FontSize.sm, color: Colors.textSecondary, marginRight: Spacing.sm },
  versionText: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.textLight, marginTop: Spacing.xxl, marginBottom: Spacing.lg },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.error + '10',
    borderRadius: BorderRadius.md,
  },
  logoutText: { fontSize: FontSize.md, color: Colors.error, fontWeight: '600' },
});
