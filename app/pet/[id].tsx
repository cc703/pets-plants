import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { safeBack } from '../../src/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';
import { usePets } from '../../src/contexts/PetContext';
import { getBreedById } from '../../src/data/breeds';
import PetIllustration from '../../src/components/PetIllustration';
import OptimizedImage from '../../src/components/OptimizedImage';
import type { VirtualPet } from '../../src/types';
import type { InteractionType } from '../../src/services/petService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const useNativeDriver = Platform.OS !== 'web';

// ---- 配置 ----

const STAT_CONFIG = [
  { key: 'health' as const, label: '健康', icon: 'heart', colors: ['#4CD964', '#6EE7A0'] as [string, string] },
  { key: 'happiness' as const, label: '快乐', icon: 'happy', colors: ['#F4A261', '#F8C89A'] as [string, string] },
  { key: 'hunger' as const, label: '饱腹', icon: 'restaurant', colors: ['#FF9500', '#FFB84D'] as [string, string] },
  { key: 'energy' as const, label: '精力', icon: 'flash', colors: ['#5AC8FA', '#8ADAFF'] as [string, string] },
  { key: 'cleanliness' as const, label: '清洁', icon: 'water', colors: ['#5E5CE6', '#8B8AFF'] as [string, string] },
];

const INTERACTIONS: {
  type: InteractionType;
  label: string;
  icon: string;
  color: string;
  desc: string;
}[] = [
  { type: 'feed', label: '喂食', icon: 'restaurant', color: '#FF9500', desc: '+饱腹 +健康' },
  { type: 'play', label: '玩耍', icon: 'game-controller', color: '#F4A261', desc: '+快乐 -精力' },
  { type: 'bath', label: '洗澡', icon: 'water', color: '#5E5CE6', desc: '+清洁 +快乐' },
  { type: 'rest', label: '休息', icon: 'moon', color: '#5AC8FA', desc: '+精力 +健康' },
];

// ---- 动画进度条 ----

const AnimatedStatBar = React.memo<{
  label: string;
  value: number;
  icon: string;
  colors: [string, string];
  delay?: number;
}>(({ label, value, icon, colors, delay = 0 }) => {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const prevValue = useRef(value);

  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: value,
      tension: 40,
      friction: 8,
      delay,
      useNativeDriver: false, // 必须 false，width 动画不支持 native driver
    }).start();
    prevValue.current = value;
  }, [value]);

  const barWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const getStatusEmoji = (v: number) => {
    if (v >= 80) return '';
    if (v >= 50) return '';
    if (v >= 20) return '';
    return '';
  };

  return (
    <View style={statStyles.container}>
      <View style={statStyles.header}>
        <View style={statStyles.labelRow}>
          <Ionicons name={icon as any} size={16} color={colors[0]} />
          <Text style={statStyles.label}>{label}</Text>
        </View>
        <Text style={[statStyles.value, { color: value < 30 ? Colors.error : Colors.text }]}>
          {value}
        </Text>
      </View>
      <View style={statStyles.barBg}>
        <Animated.View style={[statStyles.barFill, { width: barWidth }]}>
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </View>
  );
});

const statStyles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  value: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  barBg: {
    height: 10,
    backgroundColor: Colors.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
    overflow: 'hidden',
  },
});

// ---- 互动按钮 ----

const InteractionButton = React.memo<{
  type: InteractionType;
  label: string;
  icon: string;
  color: string;
  desc: string;
  onPress: () => void;
  disabled?: boolean;
  delay?: number;
}>(({ type, label, icon, color, desc, onPress, disabled, delay = 0 }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay,
      tension: 50,
      friction: 7,
      useNativeDriver,
    }).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(pressAnim, {
      toValue: 0.92,
      tension: 100,
      friction: 5,
      useNativeDriver,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      tension: 100,
      friction: 5,
      useNativeDriver,
    }).start();
  };

  return (
    <Animated.View
      style={[
        interactStyles.wrapper,
        { opacity: scaleAnim, transform: [{ scale: Animated.multiply(scaleAnim, pressAnim) }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[interactStyles.btn, disabled && interactStyles.btnDisabled]}
      >
        <View style={[interactStyles.iconWrap, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon as any} size={26} color={color} />
        </View>
        <Text style={interactStyles.label}>{label}</Text>
        <Text style={interactStyles.desc}>{desc}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

const interactStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md * 3) / 2,
  },
  btn: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.md,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  desc: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
});

// ---- 飘字动画 ----

const FloatingText = React.memo<{
  text: string;
  color: string;
  onDone: () => void;
}>(({ text, color, onDone }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -60,
        duration: 1200,
        useNativeDriver,
      }),
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver,
        }),
      ]),
    ]).start(onDone);
  }, []);

  return (
    <Animated.View
      style={[floatStyles.container, { transform: [{ translateY }], opacity }]}
      pointerEvents="none"
    >
      <Text style={[floatStyles.text, { color }]}>{text}</Text>
    </Animated.View>
  );
});

const floatStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  text: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    textShadowColor: 'rgba(255,255,255,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

// ---- 主页面 ----

export default function PetDetailPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pets, interactWithPet, getBreedName } = usePets();
  const [floats, setFloats] = useState<{ id: number; text: string; color: string }[]>([]);
  const floatIdRef = useRef(0);
  const bounceAnim = useRef(new Animated.Value(0)).current;

  const pet = pets.find(p => p.id === id);
  const breed = pet ? getBreedById(pet.breedId) : null;
  const species = breed?.species ?? 'cat';
  const accent = species === 'cat' ? Colors.primary : Colors.secondary;

  // 宠物图片弹跳动画
  const triggerBounce = useCallback(() => {
    bounceAnim.setValue(0);
    Animated.sequence([
      Animated.timing(bounceAnim, {
        toValue: -12,
        duration: 150,
        useNativeDriver,
      }),
      Animated.spring(bounceAnim, {
        toValue: 0,
        tension: 200,
        friction: 5,
        useNativeDriver,
      }),
    ]).start();
  }, []);

  const addFloat = useCallback((text: string, color: string) => {
    const id = ++floatIdRef.current;
    setFloats(prev => [...prev, { id, text, color }]);
  }, []);

  const removeFloat = useCallback((floatId: number) => {
    setFloats(prev => prev.filter(f => f.id !== floatId));
  }, []);

  const handleInteract = useCallback(async (type: InteractionType) => {
    if (!pet) return;
    triggerBounce();

    const messages: Record<InteractionType, { text: string; color: string }> = {
      feed: { text: '+25 饱腹 +5 快乐 +3 健康', color: '#FF9500' },
      play: { text: '+20 快乐 -15 精力 +15 EXP', color: '#F4A261' },
      bath: { text: '+30 清洁 +5 快乐', color: '#5E5CE6' },
      rest: { text: '+30 精力 +5 健康', color: '#5AC8FA' },
    };

    addFloat(messages[type].text, messages[type].color);
    await interactWithPet(pet.id, type);
  }, [pet, interactWithPet, triggerBounce, addFloat]);

  if (!pet) {
    return (
      <SafeAreaView style={detailStyles.container} edges={['top']}>
        <View style={detailStyles.header}>
          <TouchableOpacity onPress={() => safeBack()} style={detailStyles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={detailStyles.headerTitle}>宠物详情</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: Colors.textSecondary }}>未找到宠物</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={detailStyles.container} edges={['top']}>
      {/* 飘字层 */}
      {floats.map(f => (
        <FloatingText
          key={f.id}
          text={f.text}
          color={f.color}
          onDone={() => removeFloat(f.id)}
        />
      ))}

      {/* 头部导航 */}
      <View style={detailStyles.header}>
        <TouchableOpacity onPress={() => safeBack()} style={detailStyles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={detailStyles.headerTitle}>{pet.name}</Text>
        <View style={detailStyles.headerRight}>
          <View style={[detailStyles.stageBadge, { backgroundColor: getStageColor(pet.stage) + '20' }]}>
            <Text style={[detailStyles.stageText, { color: getStageColor(pet.stage) }]}>
              {pet.stage}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={detailStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 宠物大头像 */}
        <View style={detailStyles.avatarSection}>
          <LinearGradient
            colors={[accent + '15', accent + '05', Colors.background]}
            style={detailStyles.avatarGradient}
          >
            <Animated.View
              style={[
                detailStyles.avatarWrap,
                { transform: [{ translateY: bounceAnim }] },
              ]}
            >
              {breed?.imageUrl ? (
                <OptimizedImage
                  uri={breed.imageUrl}
                  style={{ width: 140, height: 140 }}
                  borderRadius={28}
                />
              ) : (
                <PetIllustration species={species} size={100} color={accent} />
              )}
            </Animated.View>

            <Text style={detailStyles.petName}>{pet.name}</Text>
            <Text style={detailStyles.petBreed}>{breed?.name ?? '未知品种'}</Text>

            {/* 等级与经验 */}
            <View style={detailStyles.levelSection}>
              <View style={[detailStyles.levelBadge, { backgroundColor: accent + '15' }]}>
                <Text style={[detailStyles.levelText, { color: accent }]}>Lv.{pet.level}</Text>
              </View>
              <View style={detailStyles.expBarWrap}>
                <View style={detailStyles.expBarBg}>
                  <LinearGradient
                    colors={[accent, accent + 'CC']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      detailStyles.expBarFill,
                      { width: `${(pet.experience / (pet.level * 100)) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={detailStyles.expText}>
                  {pet.experience} / {pet.level * 100} EXP
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* 属性面板 */}
        <View style={detailStyles.statsSection}>
          <View style={detailStyles.sectionHeader}>
            <View style={[detailStyles.sectionDot, { backgroundColor: accent }]} />
            <Text style={detailStyles.sectionTitle}>状态</Text>
          </View>
          {STAT_CONFIG.map((stat, i) => (
            <AnimatedStatBar
              key={stat.key}
              label={stat.label}
              value={pet[stat.key]}
              icon={stat.icon}
              colors={stat.colors}
              delay={i * 80}
            />
          ))}
        </View>

        {/* 互动区 */}
        <View style={detailStyles.interactSection}>
          <View style={detailStyles.sectionHeader}>
            <View style={[detailStyles.sectionDot, { backgroundColor: Colors.secondary }]} />
            <Text style={detailStyles.sectionTitle}>互动</Text>
          </View>
          <View style={detailStyles.interactGrid}>
            {INTERACTIONS.map((item, i) => (
              <InteractionButton
                key={item.type}
                type={item.type}
                label={item.label}
                icon={item.icon}
                color={item.color}
                desc={item.desc}
                delay={300 + i * 80}
                onPress={() => handleInteract(item.type)}
              />
            ))}
          </View>
        </View>

        {/* 品种简介 */}
        {breed && (
          <View style={detailStyles.infoSection}>
            <View style={detailStyles.sectionHeader}>
              <View style={[detailStyles.sectionDot, { backgroundColor: '#9B5DE5' }]} />
              <Text style={detailStyles.sectionTitle}>品种信息</Text>
            </View>
            <View style={detailStyles.infoCard}>
              <View style={detailStyles.infoRow}>
                <Text style={detailStyles.infoLabel}>品种</Text>
                <Text style={detailStyles.infoValue}>{breed.name}</Text>
              </View>
              <View style={detailStyles.infoRow}>
                <Text style={detailStyles.infoLabel}>英文名</Text>
                <Text style={detailStyles.infoValue}>{breed.nameEn}</Text>
              </View>
              <View style={detailStyles.infoRow}>
                <Text style={detailStyles.infoLabel}>产地</Text>
                <Text style={detailStyles.infoValue}>{breed.originCountry}</Text>
              </View>
              <View style={detailStyles.infoRow}>
                <Text style={detailStyles.infoLabel}>体型</Text>
                <Text style={detailStyles.infoValue}>{breed.appearance.size}</Text>
              </View>
              <View style={detailStyles.infoRow}>
                <Text style={detailStyles.infoLabel}>性格</Text>
                <Text style={detailStyles.infoValue}>
                  {breed.temperament.keywords.join('、')}
                </Text>
              </View>
              <View style={detailStyles.infoRow}>
                <Text style={detailStyles.infoLabel}>寿命</Text>
                <Text style={detailStyles.infoValue}>
                  {breed.care.lifespan.min}-{breed.care.lifespan.max} 年
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getStageColor(stage: VirtualPet['stage']): string {
  switch (stage) {
    case '幼年': return '#5AC8FA';
    case '成年': return Colors.primary;
    case '老年': return '#9B5DE5';
  }
}

// ---- 样式 ----

const detailStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  stageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stageText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  avatarSection: {
    marginBottom: Spacing.lg,
  },
  avatarGradient: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  avatarWrap: {
    width: 140,
    height: 140,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    ...Shadows.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  petName: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
  },
  petBreed: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  levelSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xxxl,
    width: '100%',
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelText: {
    fontSize: 14,
    fontWeight: '800',
  },
  expBarWrap: {
    flex: 1,
  },
  expBarBg: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  expBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  expText: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
    textAlign: 'right',
  },
  statsSection: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionDot: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  interactSection: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  interactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  infoSection: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    width: 60,
  },
  infoValue: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
});
