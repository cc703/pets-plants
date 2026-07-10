/**
 * 消息列表页
 * 展示所有私信会话
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { ensureLoggedIn, safeBack } from '../../src/utils/nav';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';
import { getConversations, formatMessageTime, type Conversation } from '../../src/services/messageService';
import { useAuth } from '../../src/contexts/AuthContext';

export default function MessageListPage() {
  const router = useRouter();
  const { status } = useAuth();
  const isLoggedIn = status === 'authenticated';
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setConversations([]);
      setLoading(false);
      return;
    }
    const init = async () => {
      setLoading(true);
      await loadConversations();
      setLoading(false);
    };
    init();
  }, [isLoggedIn, loadConversations]);

  const handleRefresh = useCallback(async () => {
    if (!isLoggedIn) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }, [isLoggedIn, loadConversations]);

  const handleConversationPress = useCallback((conv: Conversation) => {
    if (!ensureLoggedIn(isLoggedIn, '私信')) return;
    router.push(`/message/${conv.id}`);
  }, [isLoggedIn, router]);

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.convItem}
      onPress={() => handleConversationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.user.nickname?.[0] || '聊'}</Text>
        </View>
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
          </View>
        )}
      </View>
      <View style={styles.convInfo}>
        <View style={styles.convHeader}>
          <Text style={styles.convName} numberOfLines={1}>{item.user.nickname}</Text>
          <Text style={styles.convTime}>{formatMessageTime(item.updatedAt)}</Text>
        </View>
        <View style={styles.convFooter}>
          <Text style={[styles.convLastMsg, item.unreadCount > 0 && styles.convLastMsgUnread]} numberOfLines={1}>
            {item.lastMessage || '开始聊天吧'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>私信</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[Colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name={isLoggedIn ? 'chatbubbles-outline' : 'lock-closed-outline'}
              size={48}
              color={Colors.textLight}
            />
            <Text style={styles.emptyText}>{isLoggedIn ? '暂无私信' : '登录后查看私信'}</Text>
            <Text style={styles.emptyHint}>
              {isLoggedIn ? '去社区认识更多宠物爱好者吧' : '和其他宠物爱好者建立联系后，消息会显示在这里'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  listContent: { paddingBottom: 20 },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  avatarWrap: { position: 'relative', marginRight: Spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadText: { fontSize: 10, color: Colors.surface, fontWeight: '600' },
  convInfo: { flex: 1 },
  convHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, flex: 1 },
  convTime: { fontSize: FontSize.xs, color: Colors.textLight },
  convFooter: { marginTop: 4 },
  convLastMsg: { fontSize: FontSize.sm, color: Colors.textSecondary },
  convLastMsgUnread: { color: Colors.text, fontWeight: '500' },
  emptyState: { alignItems: 'center', paddingVertical: 80, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary },
  emptyHint: { fontSize: FontSize.sm, color: Colors.textLight },
});
