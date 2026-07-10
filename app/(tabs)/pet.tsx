import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  FlatList,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';
import { breeds, getBreedById } from '../../src/data/breeds';
import { usePets } from '../../src/contexts/PetContext';
import PetIllustration from '../../src/components/PetIllustration';
import OptimizedImage from '../../src/components/OptimizedImage';
import type { Breed, Species, VirtualPet } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const useNativeDriver = Platform.OS !== 'web';

// ---- 状态条颜色映射 ----
const STAT_COLORS: Record<string, [string, string]> = {
  health: ['#4CD964', '#6EE7A0'],
  happiness: ['#F4A261', '#F8C89A'],
  hunger: ['#FF9500', '#FFB84D'],
  energy: ['#5AC8FA', '#8ADAFF'],
  cleanliness: ['#5E5CE6', '#8B8AFF'],
};

const STAT_LABELS: Record<string, string> = {
  health: '健康',
  happiness: '快乐',
  hunger: '饱腹',
  energy: '精力',
  cleanliness: '清洁',
};

const STAT_ICONS: Record<string, string> = {
  health: 'heart',
  happiness: 'happy',
  hunger: 'restaurant',
  energy: 'flash',
  cleanliness: 'water',
};

// ---- 迷你状态条 ----

const MiniStatBar = React.memo<{
  label: string;
  value: number;
  colors: [string, string];
  icon: string;
  delay?: number;
}>(({ label, value, colors, icon, delay = 0 }) => {
  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animVal, {
      toValue: 1,
      duration: 600,
      delay,
      useNativeDriver,
    }).start();
  }, []);

  return (
    <View style={miniStyles.row}>
      <Ionicons name={icon as any} size={12} color={colors[0]} style={{ width: 16 }} />
      <Text style={miniStyles.label}>{label}</Text>
      <View style={miniStyles.bar}>
        <Animated.View
          style={[
            miniStyles.fill,
            {
              width: animVal.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', `${value}%`],
              }),
            },
          ]}
        >
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      <Text style={miniStyles.value}>{value}</Text>
    </View>
  );
});

const miniStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    color: Colors.textSecondary,
    width: 30,
  },
  bar: {
    flex: 1,
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginHorizontal: 6,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
  },
  value: {
    fontSize: 11,
    color: Colors.textSecondary,
    width: 26,
    textAlign: 'right',
  },
});

// ---- 宠物卡片 ----

const PetCard = React.memo<{
  pet: VirtualPet;
  onPress: () => void;
  onDelete: () => void;
  delay?: number;
}>(({ pet, onPress, onDelete, delay = 0 }) => {
  const breed = getBreedById(pet.breedId);
  const species = breed?.species ?? 'cat';
  const accent = species === 'cat' ? Colors.primary : Colors.secondary;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay,
        tension: 50,
        friction: 7,
        useNativeDriver,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        cardStyles.wrapper,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={cardStyles.touch}>
        <LinearGradient
          colors={[accent + '0C', accent + '03', Colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={cardStyles.card}
        >
          {/* 顶部：头像 + 名字 + 等级 */}
          <View style={cardStyles.header}>
            <View style={[cardStyles.avatar, { backgroundColor: accent + '15' }]}>
              {breed?.imageUrl ? (
                <OptimizedImage uri={breed.imageUrl} style={{ width: 56, height: 56 }} borderRadius={14} />
              ) : (
                <PetIllustration species={species} size={40} color={accent} />
              )}
            </View>
            <View style={cardStyles.headerInfo}>
              <View style={cardStyles.nameRow}>
                <Text style={cardStyles.name} numberOfLines={1}>{pet.name}</Text>
                <View style={[cardStyles.levelBadge, { backgroundColor: accent + '15' }]}>
                  <Text style={[cardStyles.levelText, { color: accent }]}>Lv.{pet.level}</Text>
                </View>
              </View>
              <Text style={cardStyles.breed}>{breed?.name ?? '未知品种'}</Text>
              <View style={cardStyles.stageRow}>
                <View style={[cardStyles.stageBadge, { backgroundColor: getStageColor(pet.stage) + '20' }]}>
                  <Text style={[cardStyles.stageText, { color: getStageColor(pet.stage) }]}>
                    {pet.stage}
                  </Text>
                </View>
                <Text style={cardStyles.expText}>EXP {pet.experience}/{pet.level * 100}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onDelete} style={cardStyles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={20} color={Colors.textLight} />
            </TouchableOpacity>
          </View>

          {/* 状态条 */}
          <View style={cardStyles.stats}>
            {(['health', 'happiness', 'hunger', 'energy', 'cleanliness'] as const).map((key, i) => (
              <MiniStatBar
                key={key}
                label={STAT_LABELS[key]}
                value={pet[key]}
                colors={STAT_COLORS[key]}
                icon={STAT_ICONS[key]}
                delay={delay + i * 60}
              />
            ))}
          </View>

          {/* 底部箭头 */}
          <View style={cardStyles.footer}>
            <Text style={[cardStyles.detailHint, { color: accent }]}>查看详情 & 互动</Text>
            <Ionicons name="chevron-forward" size={14} color={accent} />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});

const cardStyles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.md,
  },
  touch: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    flexShrink: 1,
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '700',
  },
  breed: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  stageBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  stageText: {
    fontSize: 11,
    fontWeight: '600',
  },
  expText: {
    fontSize: 10,
    color: Colors.textLight,
  },
  deleteBtn: {
    padding: 4,
  },
  stats: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
  },
  detailHint: {
    fontSize: 12,
    fontWeight: '500',
  },
});

// ---- 领养弹窗 ----

const AdoptModal = React.memo<{
  visible: boolean;
  onClose: () => void;
  onAdopt: (breedId: string) => void;
}>(({ visible, onClose, onAdopt }) => {
  const [filter, setFilter] = useState<Species | 'all'>('all');
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 9,
        useNativeDriver,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: Dimensions.get('window').height,
        duration: 300,
        useNativeDriver,
      }).start();
    }
  }, [visible]);

  const filtered = useMemo(() => {
    if (filter === 'all') return breeds;
    return breeds.filter(b => b.species === filter);
  }, [filter]);

  if (!visible) return null;

  return (
    <View style={adoptStyles.overlay}>
      <TouchableOpacity style={adoptStyles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={[
          adoptStyles.sheet,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={adoptStyles.handle} />
        <Text style={adoptStyles.title}>选择品种领养</Text>

        {/* 筛选标签 */}
        <View style={adoptStyles.filterRow}>
          {[
            { key: 'all', label: '全部' },
            { key: 'cat', label: '猫咪' },
            { key: 'dog', label: '狗狗' },
          ].map(item => (
            <TouchableOpacity
              key={item.key}
              style={[
                adoptStyles.filterChip,
                filter === item.key && adoptStyles.filterChipActive,
              ]}
              onPress={() => setFilter(item.key as any)}
            >
              <Text
                style={[
                  adoptStyles.filterText,
                  filter === item.key && adoptStyles.filterTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          numColumns={3}
          columnWrapperStyle={{ gap: Spacing.sm }}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const accent = item.species === 'cat' ? Colors.primary : Colors.secondary;
            return (
              <TouchableOpacity
                style={adoptStyles.breedItem}
                activeOpacity={0.75}
                onPress={() => onAdopt(item.id)}
              >
                <View style={[adoptStyles.breedAvatar, { backgroundColor: accent + '12' }]}>
                  {item.imageUrl ? (
                    <OptimizedImage uri={item.imageUrl} style={{ width: 52, height: 52 }} borderRadius={12} />
                  ) : (
                    <PetIllustration species={item.species} size={36} color={accent} />
                  )}
                </View>
                <Text style={adoptStyles.breedName} numberOfLines={1}>{item.name}</Text>
                <Text style={adoptStyles.breedOrigin}>{item.originCountry}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </Animated.View>
    </View>
  );
});

const adoptStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.overlay,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: Colors.primary,
  },
  breedItem: {
    flex: 1,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  breedAvatar: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 6,
  },
  breedName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  breedOrigin: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 1,
  },
});

// ---- 命名弹窗 ----

const NameModal = React.memo<{
  visible: boolean;
  breedName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}>(({ visible, breedName, onConfirm, onCancel }) => {
  const [name, setName] = useState('');
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setName('');
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={nameStyles.overlay}>
      <TouchableOpacity style={nameStyles.backdrop} activeOpacity={1} onPress={onCancel} />
      <Animated.View
        style={[
          nameStyles.dialog,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Text style={nameStyles.title}>给你的{breedName}取个名字</Text>
        <View style={nameStyles.inputWrap}>
          <Text
            style={[
              nameStyles.input,
              !name && nameStyles.placeholder,
            ]}
          >
            {name || '请输入宠物名字...'}
          </Text>
        </View>
        {/* 简易输入：用多个快捷名字按钮 */}
        <View style={nameStyles.quickRow}>
          {getQuickNames(breedName).map(n => (
            <TouchableOpacity
              key={n}
              style={[nameStyles.quickChip, name === n && nameStyles.quickChipActive]}
              onPress={() => setName(n)}
            >
              <Text style={[nameStyles.quickText, name === n && nameStyles.quickTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* 手动输入提示 */}
        <View style={nameStyles.manualInputWrap}>
          <TextInputSimple value={name} onChange={setName} placeholder="自定义名字..." />
        </View>
        <View style={nameStyles.btnRow}>
          <TouchableOpacity style={nameStyles.cancelBtn} onPress={onCancel}>
            <Text style={nameStyles.cancelText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[nameStyles.confirmBtn, !name.trim() && nameStyles.confirmBtnDisabled]}
            onPress={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim()}
          >
            <Text style={nameStyles.confirmText}>领养</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
});

/** 超简易文本输入（RN web 兼容） */
function TextInputSimple({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  // 使用原生 TextInput
  const { TextInput } = require('react-native');
  return (
    <TextInput
      style={nameStyles.textInput}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={Colors.textLight}
      maxLength={12}
      autoFocus
    />
  );
}

function getQuickNames(breedName: string): string[] {
  const pool = ['小宝', '豆豆', '球球', '团团', '毛毛', '糯米', '奶茶', '布丁', '花花', '皮蛋', '旺财', '大橘'];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 4);
}

const nameStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.overlay,
  },
  dialog: {
    width: SCREEN_WIDTH - 60,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.lg,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  inputWrap: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  input: {
    fontSize: FontSize.lg,
    color: Colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  placeholder: {
    color: Colors.textLight,
    fontWeight: '400',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.md,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickChipActive: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  quickText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  quickTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  manualInputWrap: {
    marginBottom: Spacing.lg,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    fontSize: FontSize.md,
    color: '#fff',
    fontWeight: '700',
  },
});

// ---- 阶段颜色 ----

function getStageColor(stage: VirtualPet['stage']): string {
  switch (stage) {
    case '幼年':
      return '#5AC8FA';
    case '成年':
      return Colors.primary;
    case '老年':
      return '#9B5DE5';
  }
}

// ---- 主页面 ----

export default function PetPage() {
  const router = useRouter();
  const { pets, loading, adoptNewPet, removePet, refreshPets, getBreedName } = usePets();
  const [showAdopt, setShowAdopt] = useState(false);
  const [selectedBreedId, setSelectedBreedId] = useState<string | null>(null);
  const [showName, setShowName] = useState(false);
  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerFade, {
      toValue: 1,
      duration: 500,
      useNativeDriver,
    }).start();
  }, []);

  // 选择品种后打开命名弹窗
  const handleSelectBreed = useCallback((breedId: string) => {
    setSelectedBreedId(breedId);
    setShowAdopt(false);
    setShowName(true);
  }, []);

  // 确认领养
  const handleConfirmAdopt = useCallback(async (name: string) => {
    if (!selectedBreedId) return;
    await adoptNewPet(selectedBreedId, name);
    setShowName(false);
    setSelectedBreedId(null);
  }, [selectedBreedId, adoptNewPet]);

  // 删除宠物
  const handleDelete = useCallback((pet: VirtualPet) => {
    const breedName = getBreedName(pet.breedId);
    if (Platform.OS === 'web') {
      if (window.confirm(`确定要放生 ${pet.name}（${breedName}）吗？`)) {
        removePet(pet.id);
      }
    } else {
      Alert.alert('放生宠物', `确定要放生 ${pet.name}（${breedName}）吗？`, [
        { text: '取消', style: 'cancel' },
        { text: '确定', style: 'destructive', onPress: () => removePet(pet.id) },
      ]);
    }
  }, [getBreedName, removePet]);

  const selectedBreed = selectedBreedId ? getBreedById(selectedBreedId) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 头部 */}
      <Animated.View style={[styles.header, { opacity: headerFade }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>我的宠物</Text>
          <Text style={styles.subtitle}>
            {pets.length > 0 ? `已领养 ${pets.length} 只宠物` : '领养你的第一只虚拟宠物'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          activeOpacity={0.75}
          onPress={() => setShowAdopt(true)}
        >
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.addBtnText}>领养</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* 内容区 */}
      {loading ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>加载中...</Text>
        </View>
      ) : pets.length === 0 ? (
        // 空状态
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <PetIllustration species="cat" size={80} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>还没有宠物</Text>
          <Text style={styles.emptyDesc}>领养一只可爱的虚拟宠物，照顾它一起成长吧！</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            activeOpacity={0.8}
            onPress={() => setShowAdopt(true)}
          >
            <Ionicons name="paw" size={18} color="#fff" />
            <Text style={styles.emptyBtnText}>去领养</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {pets.map((pet, index) => (
            <PetCard
              key={pet.id}
              pet={pet}
              delay={index * 80}
              onPress={() => router.push(`/pet/${pet.id}`)}
              onDelete={() => handleDelete(pet)}
            />
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* 领养弹窗 */}
      <AdoptModal
        visible={showAdopt}
        onClose={() => setShowAdopt(false)}
        onAdopt={handleSelectBreed}
      />

      {/* 命名弹窗 */}
      <NameModal
        visible={showName}
        breedName={selectedBreed?.name ?? '宠物'}
        onConfirm={handleConfirmAdopt}
        onCancel={() => {
          setShowName(false);
          setSelectedBreedId(null);
        }}
      />
    </SafeAreaView>
  );
}

// ---- 样式 ----

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    ...Shadows.md,
  },
  addBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#fff',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptyDesc: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    ...Shadows.md,
  },
  emptyBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#fff',
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
  },
});
