import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import PostCard from '../src/components/community/PostCard';
import { useAuth } from '../src/contexts/AuthContext';
import { deletePost, getUserPosts } from '../src/services/postService';
import type { Post } from '../src/types';
import { BorderRadius, Colors, FontSize, Spacing } from '../src/utils/theme';

export default function MyPostsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPosts = useCallback(async (refresh = false) => {
    if (!user?.id) return;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await getUserPosts(user.id, 1, 50);
      setPosts(result.data);
    } catch {
      setError('发布记录加载失败，请重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleDelete = useCallback(async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await deletePost(pendingDelete.id);
      setPosts((current) => current.filter((post) => post.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch {
      Alert.alert('删除失败', '帖子未能删除，请稍后重试');
    } finally {
      setDeleting(false);
    }
  }, [deleting, pendingDelete]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity
          testID="my-posts-back"
          style={styles.iconButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="返回个人中心"
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>我的发布</Text>
        <TouchableOpacity
          testID="my-posts-create"
          style={styles.iconButton}
          onPress={() => router.push('/post/create')}
          accessibilityRole="button"
          accessibilityLabel="发布动态"
        >
          <Ionicons name="add" size={25} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.stateText}>正在加载发布记录...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="cloud-offline-outline" size={46} color={Colors.textLight} />
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity testID="my-posts-retry" style={styles.retryButton} onPress={() => loadPosts()}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="document-text-outline" size={50} color={Colors.textLight} />
          <Text style={styles.emptyTitle}>还没有发布内容</Text>
          <Text style={styles.stateText}>记录一次和宠物相处的日常吧</Text>
          <TouchableOpacity testID="my-posts-empty-create" style={styles.createButton} onPress={() => router.push('/post/create')}>
            <Text style={styles.createButtonText}>去发布</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPosts(true)} colors={[Colors.primary]} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.summary}>共 {posts.length} 条发布</Text>
          {posts.map((post) => (
            <View key={post.id} style={styles.postItem}>
              <PostCard post={post} onPress={() => router.push(`/post/${post.id}`)} />
              <TouchableOpacity
                testID={`my-post-delete-${post.id}`}
                style={styles.deleteButton}
                onPress={() => setPendingDelete(post)}
                accessibilityRole="button"
                accessibilityLabel="删除这条发布"
              >
                <Ionicons name="trash-outline" size={16} color={Colors.error} />
                <Text style={styles.deleteText}>删除</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={Boolean(pendingDelete)} transparent animationType="fade" onRequestClose={() => setPendingDelete(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Ionicons name="trash-outline" size={30} color={Colors.error} />
            <Text style={styles.modalTitle}>删除这条发布？</Text>
            <Text style={styles.modalText}>删除后无法恢复，相关评论也将不再展示。</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setPendingDelete(null)} disabled={deleting}>
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={pendingDelete ? `my-post-confirm-delete-${pendingDelete.id}` : undefined}
                style={styles.confirmButton}
                onPress={handleDelete}
                disabled={deleting}
              >
                <Text style={styles.confirmText}>{deleting ? '删除中...' : '确认删除'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { height: 56, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  stateText: { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center' },
  emptyTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginTop: Spacing.sm },
  retryButton: { marginTop: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.primary },
  retryText: { color: Colors.surface, fontSize: FontSize.sm, fontWeight: '700' },
  createButton: { marginTop: Spacing.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.primary },
  createButtonText: { color: Colors.surface, fontSize: FontSize.sm, fontWeight: '700' },
  listContent: { paddingBottom: Spacing.xxl },
  summary: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, color: Colors.textSecondary, fontSize: FontSize.sm },
  postItem: { backgroundColor: Colors.surface, marginBottom: Spacing.sm },
  deleteButton: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: Spacing.lg, marginBottom: Spacing.md, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.sm, backgroundColor: Colors.error + '12' },
  deleteText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600' },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  modalCard: { width: '100%', maxWidth: 360, alignItems: 'center', padding: Spacing.xl, borderRadius: BorderRadius.lg, backgroundColor: Colors.surface },
  modalTitle: { marginTop: Spacing.md, color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  modalText: { marginTop: Spacing.sm, color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center' },
  modalActions: { width: '100%', flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl },
  cancelButton: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.background },
  cancelText: { color: Colors.textSecondary, fontWeight: '700' },
  confirmButton: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.error },
  confirmText: { color: Colors.surface, fontWeight: '700' },
});
