import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, FontSize, Shadows, getAccentColor } from '../../src/utils/theme';
import { breeds } from '../../src/data/breeds';
import { usePets } from '../../src/contexts/PetContext';
import { getBreedById } from '../../src/data/breeds';
import PetIllustration from '../../src/components/PetIllustration';
import OptimizedImage from '../../src/components/OptimizedImage';

// 今日知识数据
const knowledgeItems = [
  {
    icon: 'bulb' as const,
    title: '你知道吗？',
    text: '猫咪每天要睡 12-16 个小时，它们一生中约有 70% 的时间都在睡觉。',
    source: '品种百科',
  },
  {
    icon: 'heart' as const,
    title: '健康小贴士',
    text: '狗狗的正常体温是 38-39°C，比人类高 1-2 度。如果超过 39.5°C 就需要就医了。',
    source: '养护指南',
  },
  {
    icon: 'star' as const,
    title: '品种趣闻',
    text: '柯基的屁股被称为"蜜桃臀"，是社交媒体上的网红。英国女王一生养了超过 30 只柯基！',
    source: '趣味百科',
  },
  {
    icon: 'nutrition' as const,
    title: '饮食知识',
    text: '巧克力对狗狗来说是致命毒物！可可碱会导致狗狗中毒，严重时甚至会致命。',
    source: '安全须知',
  },
  {
    icon: 'fitness' as const,
    title: '运动建议',
    text: '金毛寻回犬每天需要至少 1 小时的运动量，包括散步、游泳和接球游戏。',
    source: '运动指南',
  },
  {
    icon: 'sparkles' as const,
    title: '冷知识',
    text: '猫咪的胡须宽度和身体宽度一样，它们用胡须来判断能否通过狭窄的空间。',
    source: '趣味百科',
  },
  {
    icon: 'medkit' as const,
    title: '护理提醒',
    text: '定期给猫咪刷牙可以预防牙周病。建议每周刷牙 2-3 次，使用宠物专用牙膏。',
    source: '护理指南',
  },
  {
    icon: 'happy' as const,
    title: '行为解读',
    text: '狗狗摇尾巴不一定代表开心！尾巴向右摇表示积极情绪，向左摇可能表示焦虑。',
    source: '行为学',
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 淡入动画包装组件
const FadeInView: React.FC<{
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: any;
  direction?: 'up' | 'left' | 'right' | 'none';
}> = ({ children, delay = 0, duration = 500, style, direction = 'up' }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(
    new Animated.Value(direction === 'up' ? 30 : direction === 'left' ? -30 : direction === 'right' ? 30 : 0)
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, []);

  const translateKey = direction === 'up' || direction === 'none' ? 'translateY' : 'translateX';

  return (
    <Animated.View
      style={[
        {
          opacity: fadeAnim,
          transform: [{ [translateKey]: slideAnim }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
};

// 动画化的数字计数组件
const AnimatedCounter: React.FC<{ value: string; label: string; delay?: number }> = ({
  value,
  label,
  delay = 0,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay,
        tension: 60,
        friction: 8,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.counterItem,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Text style={styles.counterValue}>{value}</Text>
      <Text style={styles.counterLabel}>{label}</Text>
    </Animated.View>
  );
};

export default function HomePage() {
  const router = useRouter();
  const { activePet } = usePets();
  const featuredBreeds = breeds.slice(0, 6);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [pressedCard, setPressedCard] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentKnowledgeIndex, setCurrentKnowledgeIndex] = useState(0);
  const knowledgeFadeAnim = useRef(new Animated.Value(1)).current;
  const personaActions = [
    {
      icon: 'paw-outline' as const,
      title: '已养宠',
      desc: '记录日常、看健康知识',
      route: '/(tabs)/community',
      color: Colors.primary,
    },
    {
      icon: 'compass-outline' as const,
      title: '准备养宠',
      desc: '先比较品种和照护成本',
      route: '/wiki',
      color: Colors.secondary,
    },
    {
      icon: 'sparkles-outline' as const,
      title: '喜欢宠物',
      desc: '云养宠、问 AI、逛社区',
      route: '/(tabs)/pet',
      color: Colors.accent,
    },
  ];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  // 切换今日知识
  const switchKnowledge = useCallback(() => {
    Animated.timing(knowledgeFadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setCurrentKnowledgeIndex(prev => (prev + 1) % knowledgeItems.length);
      Animated.timing(knowledgeFadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
  }, [knowledgeFadeAnim]);

  // 头部视差动画
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [0, -20],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0.6],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: Platform.OS !== 'web' }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* 头部 - 带视差渐变背景 */}
        <Animated.View
          style={{
            transform: [{ translateY: headerTranslateY }],
            opacity: headerOpacity,
          }}
        >
          <LinearGradient
            colors={[Colors.primary + '12', Colors.primaryLight + '06', Colors.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.logoRow}>
                  <View style={styles.logoIcon}>
                    <PetIllustration species="cat" size={28} color={Colors.primary} />
                  </View>
                  <Text style={styles.greeting}>萌宠星球</Text>
                </View>
                <Text style={styles.subtitle}>分享真实养宠日常，认识更多猫狗品种</Text>
              </View>
              <TouchableOpacity style={styles.searchBtn} activeOpacity={0.7} onPress={() => router.push('/search/result')}>
                <Ionicons name="search" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* 数据统计条 */}
            <View style={styles.statsBar}>
              <AnimatedCounter value="社区" label="真实分享" delay={200} />
              <View style={styles.statsDivider} />
              <AnimatedCounter value="30+" label="品种百科" delay={350} />
              <View style={styles.statsDivider} />
              <AnimatedCounter value="圈子" label="同好交流" delay={500} />
            </View>

            <View style={styles.heroActions}>
              <TouchableOpacity
                style={styles.heroPrimaryBtn}
                activeOpacity={0.85}
                onPress={() => router.push('/(tabs)/community')}
              >
                <Ionicons name="people" size={16} color={Colors.surface} />
                <Text style={styles.heroPrimaryText}>逛宠物社区</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heroSecondaryBtn}
                activeOpacity={0.85}
                onPress={() => router.push('/wiki')}
              >
                <Ionicons name="book" size={16} color={Colors.primaryDark} />
                <Text style={styles.heroSecondaryText}>认识品种</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.personaGrid}>
              {personaActions.map((item) => (
                <TouchableOpacity
                  key={item.title}
                  style={styles.personaCard}
                  activeOpacity={0.8}
                  onPress={() => router.push(item.route as any)}
                >
                  <View style={[styles.personaIconWrap, { backgroundColor: item.color + '14' }]}>
                    <Ionicons name={item.icon} size={17} color={item.color} />
                  </View>
                  <Text style={styles.personaTitle}>{item.title}</Text>
                  <Text style={styles.personaDesc}>{item.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* 品种速览 - 增强卡片视觉效果 */}
        <FadeInView delay={300} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionTitle}>认识品种</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/wiki')} style={styles.seeAllBtn}>
              <Text style={styles.seeAll}>更多</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            decelerationRate="fast"
            snapToInterval={116}
          >
            {featuredBreeds.map((breed, index) => {
              const accentColor = getAccentColor(breed.species);
              const isPressed = pressedCard === breed.id;

              return (
                <FadeInView
                  key={breed.id}
                  delay={400 + index * 80}
                  direction="left"
                  style={styles.featuredCard}
                >
                  <TouchableOpacity
                    onPress={() => router.push(`/breed/${breed.id}`)}
                    activeOpacity={0.85}
                    onPressIn={() => setPressedCard(breed.id)}
                    onPressOut={() => setPressedCard(null)}
                  >
                    <Animated.View
                      style={[
                        styles.featuredCardInner,
                        isPressed && styles.featuredCardPressed,
                      ]}
                    >
                      <LinearGradient
                        colors={[accentColor + '18', accentColor + '06']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.featuredAvatar}
                      >
                        {breed.imageUrl ? (
                          <OptimizedImage
                            uri={breed.imageUrl}
                            style={{ width: 72, height: 72 }}
                            borderRadius={BorderRadius.xl}
                          />
                        ) : (
                          <PetIllustration
                            species={breed.species}
                            size={52}
                            color={accentColor}
                          />
                        )}
                      </LinearGradient>
                      <Text style={styles.featuredName} numberOfLines={1}>
                        {breed.name}
                      </Text>
                      <View
                        style={[
                          styles.featuredTagBadge,
                          { backgroundColor: accentColor + '14' },
                        ]}
                      >
                        <Text style={[styles.featuredTag, { color: accentColor }]}>
                          {breed.temperament.keywords[0]}
                        </Text>
                      </View>
                      {/* 气泡装饰 */}
                      <View
                        style={[
                          styles.cardDecorBubble,
                          { backgroundColor: accentColor + '08' },
                        ]}
                      />
                    </Animated.View>
                  </TouchableOpacity>
                </FadeInView>
              );
            })}
          </ScrollView>
        </FadeInView>

        {/* 今日知识 - 可切换 */}
        <FadeInView delay={600} direction="up" style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionDot, { backgroundColor: Colors.secondary }]} />
              <Text style={styles.sectionTitle}>今日知识</Text>
            </View>
            <TouchableOpacity onPress={switchKnowledge} style={styles.switchBtn}>
              <Ionicons name="refresh" size={14} color={Colors.secondary} />
              <Text style={styles.switchText}>换一换</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity activeOpacity={0.85} onPress={switchKnowledge}>
            <LinearGradient
              colors={[Colors.secondary + '18', Colors.secondaryLight + '08', Colors.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.knowledgeCard}
            >
              <Animated.View style={{ opacity: knowledgeFadeAnim }}>
                <View style={styles.knowledgeHeader}>
                  <View style={styles.knowledgeIconWrap}>
                    <Ionicons name={knowledgeItems[currentKnowledgeIndex].icon} size={18} color={Colors.secondary} />
                  </View>
                  <Text style={styles.knowledgeTitle}>{knowledgeItems[currentKnowledgeIndex].title}</Text>
                  <View style={styles.knowledgeBadge}>
                    <Text style={styles.knowledgeBadgeText}>{currentKnowledgeIndex + 1}/{knowledgeItems.length}</Text>
                  </View>
                </View>
                <Text style={styles.knowledgeText}>
                  {knowledgeItems[currentKnowledgeIndex].text}
                </Text>
                <View style={styles.knowledgeFooter}>
                  <Text style={styles.knowledgeSource}>来源：{knowledgeItems[currentKnowledgeIndex].source}</Text>
                  <View style={styles.knowledgeArrow}>
                    <Ionicons name="arrow-forward" size={14} color={Colors.secondary} />
                  </View>
                </View>
              </Animated.View>
              {/* 卡片装饰圆点 */}
              <View style={[styles.decorCircle, { borderColor: Colors.secondary + '10' }]} />
            </LinearGradient>
          </TouchableOpacity>
        </FadeInView>

        {/* 我的宠物 - 增强视觉效果 */}
        <FadeInView delay={750} direction="up" style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionDot, { backgroundColor: '#9B5DE5' }]} />
              <Text style={styles.sectionTitle}>我的宠物</Text>
            </View>
          </View>
          {activePet ? (
            <TouchableOpacity style={styles.petCard} activeOpacity={0.85} onPress={() => router.push('/(tabs)/pet')}>
              <LinearGradient
                colors={[Colors.primary + '14', Colors.primaryLight + '06']}
                style={styles.petAvatarBg}
              >
                <PetIllustration species={getBreedById(activePet.breedId)?.species || 'cat'} size={68} color={Colors.primary} />
              </LinearGradient>
              <View style={styles.petInfo}>
                <View style={styles.petNameRow}>
                  <Text style={styles.petName}>{activePet.name}</Text>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelText}>Lv.{activePet.growth.level}</Text>
                  </View>
                </View>
                <Text style={styles.petBreed}>{getBreedById(activePet.breedId)?.name || '未知品种'}</Text>
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>心情</Text>
                    <View style={styles.progressBar}>
                      <LinearGradient
                        colors={[Colors.success, '#6EE7A0']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.progressFill, { width: `${activePet.stats.happiness}%` }]}
                      />
                    </View>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>饥饿</Text>
                    <View style={styles.progressBar}>
                      <LinearGradient
                        colors={[Colors.warning, '#FFB84D']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.progressFill, { width: `${activePet.stats.hunger}%` }]}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.petCard} activeOpacity={0.85} onPress={() => router.push('/(tabs)/pet')}>
              <LinearGradient
                colors={[Colors.primary + '14', Colors.primaryLight + '06']}
                style={styles.petAvatarBg}
              >
                <Ionicons name="add-circle-outline" size={40} color={Colors.primary} />
              </LinearGradient>
              <View style={styles.petInfo}>
                <Text style={styles.petName}>还没有宠物</Text>
                <Text style={styles.petBreed}>点击去领养一只虚拟宠物吧！</Text>
              </View>
            </TouchableOpacity>
          )}
        </FadeInView>

        {/* 热门品种 - 添加入场动画 */}
        <FadeInView delay={900} direction="up" style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionDot, { backgroundColor: Colors.accent }]} />
              <Text style={styles.sectionTitle}>热门品种</Text>
            </View>
          </View>
          {breeds.slice(0, 4).map((breed, index) => {
            const accentColor = getAccentColor(breed.species);
            return (
              <FadeInView key={breed.id} delay={1000 + index * 100} direction="left">
                <TouchableOpacity
                  style={styles.breedRow}
                  onPress={() => router.push(`/breed/${breed.id}`)}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.breedRowAvatar,
                      { backgroundColor: accentColor + '10', overflow: 'hidden' },
                    ]}
                  >
                    {breed.imageUrl ? (
                      <OptimizedImage
                        uri={breed.imageUrl}
                        style={{ width: 48, height: 48 }}
                        borderRadius={BorderRadius.md}
                      />
                    ) : (
                      <PetIllustration species={breed.species} size={36} color={accentColor} />
                    )}
                  </View>
                  <View style={styles.breedRowInfo}>
                    <Text style={styles.breedRowName}>{breed.name}</Text>
                    <Text style={styles.breedRowDesc} numberOfLines={1}>
                      {breed.temperament.keywords.join(' · ')}
                    </Text>
                  </View>
                  <View style={styles.breedRowRank}>
                    <Text style={styles.breedRowRankText}>#{index + 1}</Text>
                  </View>
                </TouchableOpacity>
              </FadeInView>
            );
          })}
        </FadeInView>

        <View style={styles.scrollEndSpacer} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  headerGradient: {
    paddingBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  greeting: {
    fontSize: FontSize.title,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    marginLeft: 44,
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  statsBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.md,
  },
  counterItem: {
    flex: 1,
    alignItems: 'center',
  },
  counterValue: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.primary,
  },
  counterLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statsDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  heroActions: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  heroPrimaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadows.md,
  },
  heroPrimaryText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.surface,
  },
  heroSecondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  heroSecondaryText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  personaGrid: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  personaCard: {
    flex: 1,
    minHeight: 104,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  personaIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  personaTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  personaDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginTop: 3,
  },
  section: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionDot: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.3,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAll: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '500',
  },
  horizontalList: {
    paddingRight: Spacing.xl,
  },
  featuredCard: {
    width: 108,
    marginRight: Spacing.md,
  },
  featuredCardInner: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    ...Shadows.md,
    position: 'relative',
    overflow: 'hidden',
  },
  featuredCardPressed: {
    transform: [{ scale: 0.96 }],
    ...Shadows.sm,
  },
  featuredAvatar: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  featuredName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  featuredTagBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: 4,
  },
  featuredTag: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  cardDecorBubble: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  knowledgeCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    position: 'relative',
    overflow: 'hidden',
    ...Shadows.md,
  },
  knowledgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  knowledgeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.secondary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  knowledgeTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  knowledgeBadge: {
    backgroundColor: Colors.secondary + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  knowledgeBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.secondary,
    fontWeight: '500',
  },
  knowledgeText: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 24,
  },
  knowledgeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: Colors.secondary + '20',
  },
  knowledgeSource: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  knowledgeArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.secondary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.secondary + '10',
  },
  switchText: {
    fontSize: FontSize.xs,
    color: Colors.secondary,
    fontWeight: '500',
  },
  decorCircle: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 20,
  },
  petCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
    overflow: 'hidden',
  },
  petAvatarBg: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  petInfo: {
    flex: 1,
  },
  petNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  petName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  levelBadge: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  levelText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  petBreed: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statRow: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    width: 32,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  breedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  breedRowAvatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  breedRowInfo: {
    flex: 1,
  },
  breedRowName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  breedRowDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  breedRowRank: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  breedRowRankText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
  },
  /** 底部安全间距，避免内容被 tab bar 遮挡 */
  scrollEndSpacer: {
    height: 100,
  },
});
