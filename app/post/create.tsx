/**
 * 发帖页面
 * 支持文字输入、图片选择、标签添加、圈子选择
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { safeBack, requireLogin } from '../../src/utils/nav';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import { createPost } from '../../src/services/postService';
import { uploadImage } from '../../src/services/api';

const MAX_IMAGES = 9;
const MAX_CONTENT_LENGTH = 2000;
const MAX_TAGS = 5;

const recommendedTags = [
  '日常', '求助', '经验分享', '新手攻略', '体检', '喂养',
  '布偶猫', '英短', '柯基', '金毛', '橘猫', '哈士奇',
  '成长日记', '搞笑', '治愈', '摄影',
];

const circleOptions = [
  { id: 'c1', name: '布偶圈', emoji: '🐱' },
  { id: 'c2', name: '英短圈', emoji: '🐱' },
  { id: 'c3', name: '柯基圈', emoji: '🐶' },
  { id: 'c4', name: '金毛圈', emoji: '🐶' },
  { id: 'c5', name: '橘猫圈', emoji: '🐱' },
  { id: 'c6', name: '哈士奇圈', emoji: '🐶' },
];

export default function CreatePostPage() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      Alert.alert('提示', '请先登录后再发帖', [
        { text: '取消', style: 'cancel' },
        { text: '去登录', onPress: () => router.replace('/(auth)/login') },
      ]);
    }
  }, [user, router]);

  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedCircle, setSelectedCircle] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  // 选择图片（使用 expo-image-picker，当前为 mock）
  const handlePickImages = useCallback(async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      Alert.alert('提示', `最多选择 ${MAX_IMAGES} 张图片`);
      return;
    }

    try {
      // 尝试使用 expo-image-picker
      const ImagePicker = await import('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map((a) => a.uri);
        setImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES));
      }
    } catch {
      // expo-image-picker 未安装时使用 mock 图片
      const mockImages = [
        'https://placekitten.com/400/400',
        'https://placekitten.com/401/401',
        'https://placekitten.com/402/402',
      ];
      const newImages = mockImages.slice(0, remaining);
      setImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES));
    }
  }, [images.length]);

  // 删除图片
  const handleRemoveImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 添加标签
  const handleAddTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim();
      if (!trimmed) return;
      if (tags.length >= MAX_TAGS) {
        Alert.alert('提示', `最多添加 ${MAX_TAGS} 个标签`);
        return;
      }
      if (tags.includes(trimmed)) {
        Alert.alert('提示', '标签已存在');
        return;
      }
      setTags((prev) => [...prev, trimmed]);
      setTagInput('');
      setShowTagSuggestions(false);
    },
    [tags],
  );

  // 删除标签
  const handleRemoveTag = useCallback((index: number) => {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 发布帖子
  const handlePublish = useCallback(async () => {
    if (!content.trim()) {
      Alert.alert('提示', '请输入帖子内容');
      return;
    }
    if (content.trim().length < 5) {
      Alert.alert('提示', '帖子内容至少 5 个字');
      return;
    }

    setPublishing(true);
    try {
      const uploadedImages = images.length > 0
        ? await Promise.all(images.map((uri) => (
          uri.startsWith('http') ? Promise.resolve({ url: uri }) : uploadImage(uri)
        )))
        : [];

      await createPost({
        content: content.trim(),
        images: uploadedImages.map((item) => item.url),
        tags: tags.length > 0 ? tags : ['日常'],
        circleId: selectedCircle || undefined,
      });
      Alert.alert('成功', '帖子发布成功！', [
        { text: '确定', onPress: () => safeBack() },
      ]);
    } catch {
      Alert.alert('错误', '发布失败，请重试');
    } finally {
      setPublishing(false);
    }
  }, [content, images, tags, selectedCircle, router]);

  // 获取标签建议
  const tagSuggestions = tagInput.trim()
    ? recommendedTags.filter(
        (t) =>
          t.includes(tagInput.trim()) && !tags.includes(t),
      )
    : recommendedTags.filter((t) => !tags.includes(t)).slice(0, 8);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 顶部导航 */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => {
            if (content.trim() || images.length > 0) {
              Alert.alert('提示', '确定放弃编辑吗？', [
                { text: '继续编辑', style: 'cancel' },
                { text: '放弃', style: 'destructive', onPress: () => safeBack() },
              ]);
            } else {
              safeBack();
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.navCancel}>取消</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>发布动态</Text>
        <TouchableOpacity
          testID="create-post-submit-btn"
          style={[
            styles.publishBtn,
            (!content.trim() || publishing) && { opacity: 0.5 },
          ]}
          onPress={handlePublish}
          disabled={!content.trim() || publishing}
          activeOpacity={0.7}
        >
          {publishing ? (
            <ActivityIndicator size="small" color={Colors.surface} />
          ) : (
            <Text style={styles.publishBtnText}>发布</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 内容输入 */}
          <TextInput
            testID="create-post-content-input"
            style={styles.contentInput}
            value={content}
            onChangeText={setContent}
            placeholder="分享你和宠物的故事..."
            placeholderTextColor={Colors.textLight}
            multiline
            maxLength={MAX_CONTENT_LENGTH}
            textAlignVertical="top"
            autoFocus
          />
          <Text style={styles.charCount}>
            {content.length} / {MAX_CONTENT_LENGTH}
          </Text>

          {/* 图片展示 */}
          {images.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imageRow}
              contentContainerStyle={styles.imageRowContent}
            >
              {images.map((uri, i) => (
                <View key={i} style={styles.imageItem}>
                  <Image source={{ uri }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.imageRemove}
                    onPress={() => handleRemoveImage(i)}
                  >
                    <Ionicons name="close-circle" size={22} color={Colors.accent} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* 分隔线 */}
          <View style={styles.divider} />

          {/* 圈子选择 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>选择圈子（可选）</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.circleRow}
            >
              {circleOptions.map((circle) => (
                <TouchableOpacity
                  key={circle.id}
                  testID={`create-post-circle-${circle.id}`}
                  style={[
                    styles.circleChip,
                    selectedCircle === circle.id && styles.circleChipActive,
                  ]}
                  onPress={() =>
                    setSelectedCircle(
                      selectedCircle === circle.id ? null : circle.id,
                    )
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.circleChipEmoji}>{circle.emoji}</Text>
                  <Text
                    style={[
                      styles.circleChipText,
                      selectedCircle === circle.id && {
                        color: Colors.primary,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {circle.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* 标签输入 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              添加标签（最多 {MAX_TAGS} 个）
            </Text>

            {/* 已选标签 */}
            {tags.length > 0 && (
              <View style={styles.selectedTags}>
                {tags.map((tag, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.selectedTag}
                    onPress={() => handleRemoveTag(i)}
                  >
                    <Text style={styles.selectedTagText}>#{tag}</Text>
                    <Ionicons
                      name="close"
                      size={14}
                      color={Colors.primary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* 标签输入框 */}
            <View style={styles.tagInputWrap}>
              <Ionicons
                name="pricetag-outline"
                size={16}
                color={Colors.textSecondary}
              />
              <TextInput
                style={styles.tagInput}
                value={tagInput}
                onChangeText={(text) => {
                  setTagInput(text);
                  setShowTagSuggestions(true);
                }}
                onSubmitEditing={() => {
                  if (tagInput.trim()) handleAddTag(tagInput);
                }}
                placeholder="输入标签名称"
                placeholderTextColor={Colors.textLight}
                returnKeyType="done"
              />
              {tagInput.trim() ? (
                <TouchableOpacity onPress={() => handleAddTag(tagInput)}>
                  <Text style={styles.tagAddBtn}>添加</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* 推荐标签 */}
            {showTagSuggestions && tagSuggestions.length > 0 && (
              <View style={styles.suggestions}>
                {tagSuggestions.map((tag, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.suggestionChip}
                    onPress={() => handleAddTag(tag)}
                  >
                    <Text style={styles.suggestionText}>#{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* 底部工具栏 */}
          <View style={styles.toolbar}>
            <TouchableOpacity
              style={styles.toolbarBtn}
              onPress={handlePickImages}
              activeOpacity={0.7}
            >
              <Ionicons name="image-outline" size={22} color={Colors.primary} />
              <Text style={styles.toolbarText}>
                图片 {images.length > 0 ? `(${images.length}/${MAX_IMAGES})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarBtn} activeOpacity={0.7}>
              <Ionicons
                name="location-outline"
                size={22}
                color={Colors.accent}
              />
              <Text style={styles.toolbarText}>位置</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarBtn} activeOpacity={0.7}>
              <Ionicons name="at-outline" size={22} color={Colors.secondary} />
              <Text style={styles.toolbarText}>提及</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  flex: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  navCancel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  navTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  publishBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    minWidth: 60,
    alignItems: 'center',
  },
  publishBtnText: {
    color: Colors.surface,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: 100,
  },
  contentInput: {
    minHeight: 150,
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 24,
    padding: 0,
  },
  charCount: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    textAlign: 'right',
    marginTop: Spacing.sm,
  },
  imageRow: {
    marginTop: Spacing.md,
  },
  imageRowContent: {
    gap: Spacing.sm,
  },
  imageItem: {
    position: 'relative',
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
  },
  imageRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.surface,
    borderRadius: 11,
  },
  divider: {
    height: 0.5,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  circleRow: {
    gap: Spacing.sm,
  },
  circleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  circleChipActive: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary,
  },
  circleChipEmoji: {
    fontSize: 16,
  },
  circleChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  selectedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xl,
  },
  selectedTagText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '500',
  },
  tagInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  tagInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    height: 44,
  },
  tagAddBtn: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  suggestionChip: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xl,
  },
  suggestionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  toolbar: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  toolbarText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});
