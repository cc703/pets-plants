import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';
import PetIllustration from '../../src/components/PetIllustration';
import { useAuth } from '../../src/contexts/AuthContext';
import { useUserPet } from '../../src/contexts/UserPetContext';
import { fetchBreeds } from '../../src/services/breedService';
import type { Breed } from '../../src/types';
import type { UserPetSex } from '../../src/services/userPetService';

const SERVICE_ERROR = '暂时无法连接服务，请稍后重试';
const sexOptions: { value: UserPetSex; label: string }[] = [
  { value: 'unknown', label: '未知' },
  { value: 'male', label: '男孩' },
  { value: 'female', label: '女孩' },
];

export default function PetPage() {
  const router = useRouter();
  const { status: authStatus } = useAuth();
  const { pet, status, error, refresh, save, remove } = useUserPet();
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [breedStatus, setBreedStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [breedId, setBreedId] = useState('');
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [sex, setSex] = useState<UserPetSex>('unknown');
  const [avatarUrl, setAvatarUrl] = useState('');

  const selectedBreed = useMemo(
    () => breeds.find((item) => item.id === breedId) ?? null,
    [breeds, breedId],
  );

  const loadBreeds = useCallback(async () => {
    setBreedStatus('loading');
    try {
      const data = await fetchBreeds({ page: 1, limit: 50 });
      setBreeds(data);
      setBreedStatus('ready');
      setBreedId(current => current || data[0]?.id || '');
    } catch {
      setBreedStatus('error');
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      loadBreeds();
    } else {
      setBreeds([]);
      setBreedStatus('idle');
      setIsEditing(false);
    }
  }, [authStatus, loadBreeds]);

  useEffect(() => {
    if (pet) {
      setBreedId(pet.breedId);
      setName(pet.name);
      setBirthday(pet.birthday ?? '');
      setSex(pet.sex);
      setAvatarUrl(pet.avatarUrl ?? '');
      setIsEditing(false);
    } else if (!isEditing) {
      setName('');
      setBirthday('');
      setSex('unknown');
      setAvatarUrl('');
    }
  }, [pet, isEditing]);

  const handleRetry = useCallback(async () => {
    await Promise.all([
      refresh().catch(() => undefined),
      loadBreeds().catch(() => undefined),
    ]);
  }, [loadBreeds, refresh]);

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    const trimmedBirthday = birthday.trim();

    if (!breedId) {
      setFormError('请选择品种');
      return;
    }
    if (!trimmedName) {
      setFormError('请填写宠物昵称');
      return;
    }
    if (trimmedBirthday && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedBirthday)) {
      setFormError('生日格式应为 YYYY-MM-DD');
      return;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      await save({
        breedId,
        name: trimmedName,
        birthday: trimmedBirthday || null,
        sex,
        avatarUrl: avatarUrl.trim() || null,
      });
      setIsEditing(false);
    } catch {
      setFormError(SERVICE_ERROR);
    } finally {
      setIsSaving(false);
    }
  }, [avatarUrl, birthday, breedId, name, save, sex]);

  const handleDelete = useCallback(() => {
    const action = async () => {
      setIsSaving(true);
      try {
        await remove();
        setName('');
        setBirthday('');
        setSex('unknown');
        setAvatarUrl('');
      } catch {
        setFormError(SERVICE_ERROR);
      } finally {
        setIsSaving(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('确定删除主宠档案吗？')) {
        action();
      }
      return;
    }

    Alert.alert('删除主宠档案', '删除后可重新创建新的主宠档案。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: action },
    ]);
  }, [remove]);

  if (authStatus === 'loading' || authStatus === 'idle') {
    return <LoadingScreen />;
  }

  if (authStatus !== 'authenticated') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerPane}>
          <View style={styles.emptyIcon}>
            <Ionicons name="person-circle-outline" size={56} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>登录后管理主宠档案</Text>
          <Text style={styles.emptyDesc}>主宠档案会保存到账号，用于个人中心和社区展示。</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(auth)/login' as any)}>
            <Text style={styles.primaryBtnText}>去登录</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'loading' || breedStatus === 'loading') {
    return <LoadingScreen />;
  }

  if (status === 'error' || breedStatus === 'error') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerPane}>
          <Ionicons name="cloud-offline-outline" size={46} color={Colors.textLight} />
          <Text style={styles.emptyTitle}>{error || SERVICE_ERROR}</Text>
          <Text style={styles.emptyDesc}>请检查后端服务和网络连接后重试。</Text>
          <TouchableOpacity testID="primary-pet-retry-btn" style={styles.primaryBtn} onPress={handleRetry}>
            <Text style={styles.primaryBtnText}>重试</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const showForm = !pet || isEditing;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>我的主宠</Text>
            <Text style={styles.subtitle}>真实宠物档案，用于日常闭环展示</Text>
          </View>
          {pet && !showForm && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => setIsEditing(true)}>
              <Ionicons name="create-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {showForm ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{pet ? '编辑主宠档案' : '创建主宠档案'}</Text>

            <Text style={styles.label}>品种</Text>
            {breeds.length === 0 ? (
              <Text style={styles.mutedText}>当前数据库暂无品种数据</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.breedScroller}>
                {breeds.map((breed) => {
                  const active = breed.id === breedId;
                  return (
                    <TouchableOpacity
                      key={breed.id}
                      testID={active ? 'primary-pet-create-breed' : undefined}
                      style={[styles.breedChip, active && styles.breedChipActive]}
                      onPress={() => setBreedId(breed.id)}
                    >
                      <Text style={[styles.breedChipText, active && styles.breedChipTextActive]}>
                        {breed.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <Text style={styles.label}>昵称</Text>
            <TextInput
              testID="primary-pet-name-input"
              value={name}
              onChangeText={setName}
              placeholder="例如：小饭团"
              placeholderTextColor={Colors.textLight}
              maxLength={50}
              style={styles.input}
            />

            <Text style={styles.label}>生日</Text>
            <TextInput
              testID="primary-pet-birthday-input"
              value={birthday}
              onChangeText={setBirthday}
              placeholder="YYYY-MM-DD，可不填"
              placeholderTextColor={Colors.textLight}
              style={styles.input}
            />

            <Text style={styles.label}>头像链接</Text>
            <TextInput
              testID="primary-pet-avatar-input"
              value={avatarUrl}
              onChangeText={setAvatarUrl}
              placeholder="可选，填写可访问的图片链接"
              placeholderTextColor={Colors.textLight}
              autoCapitalize="none"
              keyboardType="url"
              style={styles.input}
            />

            <Text style={styles.label}>性别</Text>
            <View style={styles.sexRow}>
              {sexOptions.map((option) => {
                const active = sex === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    testID={option.value === 'male' ? 'primary-pet-sex-male' : undefined}
                    style={[styles.sexBtn, active && styles.sexBtnActive]}
                    onPress={() => setSex(option.value)}
                  >
                    <Text style={[styles.sexText, active && styles.sexTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {formError && <Text style={styles.errorText}>{formError}</Text>}

            <View style={styles.actionRow}>
              {pet && (
                <TouchableOpacity
                  style={[styles.secondaryBtn, isSaving && styles.disabled]}
                  disabled={isSaving}
                  onPress={() => {
                    setIsEditing(false);
                    setFormError(null);
                  }}
                >
                  <Text style={styles.secondaryBtnText}>取消</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                testID="primary-pet-save-btn"
                style={[styles.primaryBtn, styles.actionBtn, (isSaving || breeds.length === 0) && styles.disabled]}
                disabled={isSaving || breeds.length === 0}
                onPress={handleSave}
              >
                <Text style={styles.primaryBtnText}>{isSaving ? '保存中...' : '保存档案'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.petProfile}>
              <View style={styles.avatar}>
                {pet?.avatarUrl ? (
                  <Image source={{ uri: pet.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <PetIllustration species={selectedBreed?.species ?? pet?.breed?.species ?? 'cat'} size={72} color={Colors.primary} />
                )}
              </View>
              <View style={styles.petInfo}>
                <Text style={styles.petName}>{pet?.name}</Text>
                <Text style={styles.petMeta}>{selectedBreed?.name ?? pet?.breed?.name ?? '未知品种'}</Text>
                <Text style={styles.petMeta}>{formatSex(pet?.sex)} · {pet?.birthday || '生日未填写'}</Text>
              </View>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>闭环状态</Text>
              <Text style={styles.summaryText}>主宠档案已保存，可在个人中心和后续社区身份展示中复用。</Text>
            </View>

            <TouchableOpacity style={styles.dangerBtn} disabled={isSaving} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
              <Text style={styles.dangerText}>删除档案</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LoadingScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.loadingPane}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.loadingText}>加载主宠档案...</Text>
      </View>
    </SafeAreaView>
  );
}

function formatSex(value?: UserPetSex) {
  if (value === 'male') return '男孩';
  if (value === 'female') return '女孩';
  return '性别未知';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.xl,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  breedScroller: {
    marginHorizontal: -Spacing.xs,
  },
  breedChip: {
    marginHorizontal: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  breedChipActive: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  breedChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  breedChipTextActive: {
    color: Colors.primary,
  },
  input: {
    minHeight: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  sexRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  sexBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sexBtnActive: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  sexText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  sexTextActive: {
    color: Colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  actionBtn: {
    flex: 1,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: Colors.surface,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  secondaryBtnText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.55,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    marginTop: Spacing.md,
  },
  mutedText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  petProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 24,
    backgroundColor: Colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 92,
    height: 92,
  },
  petInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  petName: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
  },
  petMeta: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  summaryBox: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
  },
  summaryTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  summaryText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: 4,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.error + '10',
  },
  dangerText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  centerPane: {
    flex: 1,
    minHeight: 360,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  loadingPane: {
    height: 360,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});
