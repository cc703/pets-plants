import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';
import { ensureLoggedIn, safeBack } from '../../src/utils/nav';
import { useAuth } from '../../src/contexts/AuthContext';
import type { Notification, NotificationType } from '../../src/types';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  formatNotificationTime,
  getNotificationIcon,
} from '../../src/services/notificationService';

export default function NotificationScreen() {
  const router = useRouter();
  const { status } = useAuth();
  const isLoggedIn = status === 'authenticated';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 加载通知列表
  const loadNotifications = useCallback(async (pageNum: number, refresh = false) => {
    if (pageNum === 1 && !refresh) setLoading(true);
    try {
      const result = await getNotifications(pageNum, 10);
      if (refresh || pageNum === 1) {
        setNotifications(result.data);
      } else {
        setNotifications((prev) => [...prev, ...result.data]);
      }
      setHasMore(result.hasMore);
      setPage(pageNum);
    } catch {
      // 忽略错误
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  // 加载未读数
  const loadUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch {
      // 忽略
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    loadNotifications(1);
    loadUnreadCount();
  }, [isLoggedIn, loadNotifications, loadUnreadCount]);

  // 下拉刷新
  const handleRefresh = useCallback(() => {
    if (!isLoggedIn) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    loadNotifications(1, true);
    loadUnreadCount();
  }, [isLoggedIn, loadNotifications, loadUnreadCount]);

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (!isLoggedIn) return;
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    loadNotifications(page + 1);
  }, [isLoggedIn, loadingMore, hasMore, page, loadNotifications]);

  // 点击通知
  const handlePressNotification = useCallback(async (item: Notification) => {
    if (!ensureLoggedIn(isLoggedIn, '消息通知')) return;
    // 标记为已读
    if (!item.isRead) {
      await markAsRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    // 跳转逻辑
    if (item.type === 'follow') {
      // 关注通知 -> 跳转到用户主页
      router.push(`/user/${item.fromUser.id}`);
    } else if (item.targetId) {
      // 帖子/评论相关 -> 跳转到帖子详情
      router.push(`/post/${item.targetId}`);
    }
  }, [isLoggedIn, router]);

  // 全部标记已读
  const handleMarkAllRead = useCallback(async () => {
    if (!ensureLoggedIn(isLoggedIn, '消息通知')) return;
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, [isLoggedIn]);

  // 获取通知图标颜色
  const getIconColor = (type: NotificationType): string => {
    switch (type) {
      case 'like':
        return '#FF3B30';
      case 'comment':
        return Colors.primary;
      case 'reply':
        return '#5856D6';
      case 'follow':
        return Colors.secondary;
      case 'system':
        return '#FF9500';
      default:
        return Colors.textSecondary;
    }
  };

  // 渲染通知项
  const renderNotification = useCallback(({ item }: { item: Notification }) => {
    const iconColor = getIconColor(item.type);
    const iconName = getNotificationIcon(item.type) as keyof typeof Ionicons.glyphMap;

    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.isRead && styles.unreadItem]}
        onPress={() => handlePressNotification(item)}
        activeOpacity={0.7}
      >
        {/* 未读指示器 */}
        {!item.isRead && <View style={styles.unreadDot} />}

        {/* 图标 */}
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
          <Ionicons name={iconName} size={20} color={iconColor} />
        </View>

        {/* 内容 */}
        <View style={styles.contentContainer}>
          <View style={styles.topRow}>
            <Text style={styles.nickname} numberOfLines={1}>
              {item.fromUser.nickname}
            </Text>
            <Text style={styles.timeText}>
              {formatNotificationTime(item.createdAt)}
            </Text>
          </View>
          <Text style={[styles.contentText, !item.isRead && styles.unreadText]} numberOfLines={2}>
            {item.content}
          </Text>
          {item.targetTitle && (
            <Text style={styles.targetTitle} numberOfLines={1}>
              原文：{item.targetTitle}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [handlePressNotification]);

  // 空状态
  const renderEmpty = useCallback(() => {
    if (loading) return null;
    if (!isLoggedIn) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="lock-closed-outline" size={64} color={Colors.textLight} />
          <Text style={styles.emptyTitle}>登录后查看通知</Text>
          <Text style={styles.emptySubtitle}>点赞、评论、关注和系统消息会集中显示在这里</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="notifications-off-outline" size={64} color={Colors.textLight} />
        <Text style={styles.emptyTitle}>暂无通知</Text>
        <Text style={styles.emptySubtitle}>当有人互动你的内容时，会在这里显示</Text>
      </View>
    );
  }, [isLoggedIn, loading]);

  // 列表底部分隔线
  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }, [loadingMore]);

  // 初始加载
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 顶部栏 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={safeBack} style={{ marginRight: 8 }}>
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>消息通知</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllButton}>
            <Ionicons name="checkmark-done" size={18} color={Colors.primary} />
            <Text style={styles.markAllText}>全部已读</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 通知列表 */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={notifications.length === 0 ? styles.emptyList : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  badge: {
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.full,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary + '10',
  },
  markAllText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    marginLeft: 4,
    fontWeight: '500',
  },
  listContent: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxxl,
  },
  emptyList: {
    flexGrow: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  unreadItem: {
    backgroundColor: Colors.primary + '06',
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  unreadDot: {
    position: 'absolute',
    top: Spacing.md + 4,
    left: Spacing.sm - 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    marginLeft: Spacing.sm,
  },
  contentContainer: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nickname: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  timeText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  contentText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  unreadText: {
    color: Colors.text,
    fontWeight: '500',
  },
  targetTitle: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: 4,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    marginTop: Spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLoader: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
});
