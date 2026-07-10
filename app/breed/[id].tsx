import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Share,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { safeBack } from '../../src/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, FontSize, Shadows, getAccentColor } from '../../src/utils/theme';
import { getBreedById, breeds } from '../../src/data/breeds';
import { useAuth } from '../../src/contexts/AuthContext';
import PetIllustration from '../../src/components/PetIllustration';
import OptimizedImage from '../../src/components/OptimizedImage';
import { addBrowsingHistory } from '../../src/services/historyService';
import { useRemoteAudioPlayer } from '../../src/hooks/useVoiceTools';
import type { TemperamentKey } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAT_VOICE = require('../../assets/audio/cat-meow.mp3');
const DOG_VOICE = CAT_VOICE;

/** 性格特征标签映射 */
const temperamentLabels: Record<TemperamentKey, string> = {
  energyLevel: '活泼度',
  affectionLevel: '亲人度',
  trainability: '训练性',
  intelligence: '智商',
  sociability: '社交性',
  vocalization: '叫声',
};

/** 性格特征颜色映射 */
const temperamentColors: Record<TemperamentKey, string> = {
  energyLevel: '#FF6B6B',
  affectionLevel: '#FF9F43',
  trainability: '#54A0FF',
  intelligence: '#5F27CD',
  sociability: '#00D2D3',
  vocalization: '#FF9FF3',
};

/** 性格特征键名列表（避免每次渲染时 Object.entries 的开销） */
const temperamentKeys = Object.keys(temperamentLabels) as TemperamentKey[];

/** 淡入滑入动画包装 */
const FadeInView: React.FC<{
  children: React.ReactNode;
  delay?: number;
  style?: any;
}> = ({ children, delay = 0, style }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(translateY, { toValue: 0, duration: 500, delay, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
};

/** 性格进度条动画 */
const AnimatedBar: React.FC<{ value: number; color: string; delay?: number }> = ({ value, color, delay = 0 }) => {
  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(widthAnim, { toValue: value * 20, duration: 800, delay, useNativeDriver: false }).start();
  }, []);
  return (
    <View style={styles.temperamentBar}>
      <Animated.View
        style={[
          styles.temperamentFill,
          {
            width: widthAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
};

export default function BreedDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const breed = getBreedById(id || '');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(128);
  const { play: playAudio, stop: stopAudio, playingKey } = useRemoteAudioPlayer();
  const scrollY = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const voiceKey = breed ? `${breed.species}-${breed.id}` : '';
  const voiceSource = breed?.species === 'cat' ? CAT_VOICE : DOG_VOICE;
  const isPlaying = !!breed && playingKey === voiceKey;

  // 播放品种声音
  const handlePlayVoice = useCallback(async () => {
    if (!breed) {
      Alert.alert('提示', '暂无该品种的声音资源');
      return;
    }
    try {
      await playAudio(voiceSource, voiceKey);
    } catch {
      const soundText = breed.species === 'cat'
        ? `${breed.name}的叫声通常是轻柔的喵，喵。`
        : `${breed.name}的叫声通常是响亮的汪，汪。`;
      Speech.speak(soundText, { language: 'zh-CN', rate: 0.9 });
    }
  }, [breed, playAudio, voiceKey, voiceSource]);

  // 清理音频资源
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  // 获取相关品种推荐（同物种的其他品种）
  const relatedBreeds = breed
    ? breeds.filter((b) => b.species === breed.species && b.id !== breed.id).slice(0, 3)
    : [];

  const handleLike = useCallback(() => {
    const newState = !liked;
    setLiked(newState);
    setFavoriteCount((prev) => (newState ? prev + 1 : prev - 1));
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.3, tension: 100, friction: 5, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(heartScale, { toValue: 1, tension: 100, friction: 5, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
    if (newState && breed) {
      Alert.alert('收藏成功', `已将 ${breed.name} 添加到收藏列表`);
    }
  }, [liked, breed, heartScale]);

  const handleShare = useCallback(async () => {
    if (!breed) return;
    try {
      await Share.share({
        message: `来看看 ${breed.name}（${breed.nameEn}）！${breed.temperament.keywords.join('、')}的${breed.species === 'cat' ? '猫咪' : '狗狗'}品种。来自萌宠星球！`,
        title: `${breed.name} - 萌宠星球`,
      });
    } catch {
      Alert.alert('分享失败', '无法分享内容，请稍后再试');
    }
  }, [breed]);

  const handleRelatedBreedPress = useCallback(
    (breedId: string) => { router.push(`/breed/${breedId}`); },
    [router]
  );

  if (!breed) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>品种未找到</Text>
      </View>
    );
  }

  const accentColor = getAccentColor(breed.species);
  const galleryImages = breed.gallery?.length ? breed.gallery : [breed.imageUrl];

  useEffect(() => {
    if (!breed) return;
    addBrowsingHistory({
      type: 'breed',
      targetId: breed.id,
      title: breed.name,
      subtitle: `${breed.originCountry} · ${breed.temperament.keywords.slice(0, 2).join(' / ')}`,
      icon: breed.species === 'cat' ? '🐱' : '🐶',
    }, user?.id).catch(() => {});
  }, [breed, user?.id]);

  // 英雄区域视差
  const heroScale = scrollY.interpolate({ inputRange: [-100, 0], outputRange: [1.15, 1], extrapolate: 'clamp' });
  const heroOpacity = scrollY.interpolate({ inputRange: [0, 160], outputRange: [1, 0.5], extrapolate: 'clamp' });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Animated.ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: Platform.OS !== 'web' }
        )}
        scrollEventThrottle={16}
      >
        {/* 英雄区域 - 视差渐变 */}
        <Animated.View style={{ opacity: heroOpacity, transform: [{ scale: heroScale }] }}>
          <LinearGradient
            colors={[accentColor + '20', accentColor + '08', Colors.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.heroSection}
          >
            <SafeAreaView edges={['top']} style={styles.heroSafeArea}>
              {/* 顶部导航 */}
              <View style={styles.heroNav}>
                <TouchableOpacity style={styles.backBtn} onPress={() => safeBack()} activeOpacity={0.7}>
                  <Ionicons name="chevron-back" size={20} color={Colors.text} />
                </TouchableOpacity>
                <View style={styles.heroActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
                    <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                      <Ionicons
                        name={liked ? 'heart' : 'heart-outline'}
                        size={20}
                        color={liked ? Colors.accent : Colors.text}
                      />
                    </Animated.View>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
                    <Ionicons name="share-outline" size={20} color={Colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* 图片轮播 */}
              <View style={styles.carouselContainer}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                    const containerW = SCREEN_WIDTH - Spacing.xl * 2;
                    setActiveImageIndex(Math.round(e.nativeEvent.contentOffset.x / containerW));
                  }}
                  scrollEventThrottle={16}
                  style={{ flexGrow: 0 }}
                >
                  {galleryImages.map((uri, index) => (
                    <View key={`${uri}-${index}`} style={[styles.carouselSlide, { width: SCREEN_WIDTH - Spacing.xl * 2 }]}>
                      <LinearGradient
                        colors={[accentColor + '18', accentColor + '06']}
                        style={styles.illustrationBg}
                      >
                        <OptimizedImage
                          uri={uri}
                          fallbackUris={galleryImages}
                          style={styles.galleryImage}
                          borderRadius={42}
                        />
                      </LinearGradient>
                    </View>
                  ))}
                </ScrollView>
                {/* 轮播指示器 */}
                <View style={styles.dotsRow}>
                  {galleryImages.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        activeImageIndex === i && styles.dotActive,
                        activeImageIndex === i && { backgroundColor: accentColor },
                      ]}
                    />
                  ))}
                </View>
              </View>

              {/* 品种信息 */}
              <View style={styles.heroInfo}>
                <Text style={styles.breedName}>{breed.name}</Text>
                <Text style={styles.breedNameEn}>{breed.nameEn}</Text>
                <View style={styles.heroBadges}>
                  <View style={styles.originBadge}>
                    <Ionicons name="location" size={12} color={accentColor} />
                    <Text style={styles.originText}>{breed.originCountry}</Text>
                  </View>
                  <View style={[styles.sizeBadge, { backgroundColor: accentColor + '15' }]}>
                    <Text style={[styles.sizeText, { color: accentColor }]}>{breed.appearance.size}</Text>
                  </View>
                  <View style={[styles.coatBadge, { backgroundColor: Colors.accent + '12' }]}>
                    <Text style={[styles.coatText, { color: Colors.accent }]}>{breed.appearance.coatLength}</Text>
                  </View>
                </View>
                {/* 收藏计数 */}
                <View style={styles.favoriteCountWrap}>
                  <Ionicons
                    name={liked ? 'heart' : 'heart-outline'}
                    size={14}
                    color={liked ? Colors.accent : Colors.textSecondary}
                  />
                  <Text style={styles.favoriteCountText}>{favoriteCount} 人收藏</Text>
                </View>
                {/* 语音播放条 */}
                {breed.voiceUrl && (
                  <TouchableOpacity
                    style={[styles.voiceBar, isPlaying && styles.voiceBarPlaying, isPlaying && { backgroundColor: accentColor + '08' }]}
                    activeOpacity={0.85}
                    onPress={handlePlayVoice}
                  >
                    <View style={[styles.voiceBarPlayBtn, isPlaying && styles.voiceBarPlayBtnPlaying]}>
                      <Ionicons
                        name={isPlaying ? 'pause' : 'play'}
                        size={18}
                        color={isPlaying ? '#FFFFFF' : accentColor}
                      />
                    </View>
                    <View style={styles.voiceBarInfo}>
                      <Text style={[styles.voiceBarTitle, isPlaying && styles.voiceBarTitlePlaying]}>
                        {isPlaying ? `${breed.species === 'cat' ? '猫咪' : '狗狗'}叫声播放中` : `点击聆听${breed.species === 'cat' ? '猫咪' : '狗狗'}叫声`}
                      </Text>
                      <View style={styles.voiceWaveform}>
                        {[...Array(20)].map((_, i) => (
                          <View
                            key={i}
                            style={[
                              styles.voiceWaveBar,
                              isPlaying && styles.voiceWaveBarActive,
                              isPlaying && {
                                height: 6 + Math.random() * 14,
                                backgroundColor: accentColor,
                                opacity: 0.6 + Math.random() * 0.4,
                              },
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                    <Ionicons
                      name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
                      size={18}
                      color={isPlaying ? accentColor : Colors.textLight}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </SafeAreaView>
          </LinearGradient>
        </Animated.View>

        {/* 核心信息卡片 */}
        <FadeInView delay={100} style={styles.section}>
          <View style={styles.infoCard}>
            <View style={styles.infoItem}>
              <View style={[styles.infoIconWrap, { backgroundColor: Colors.primary + '10' }]}>
                <Ionicons name="scale-outline" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.infoValue}>{breed.appearance.weightRange.min}-{breed.appearance.weightRange.max}kg</Text>
              <Text style={styles.infoLabel}>体重</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <View style={[styles.infoIconWrap, { backgroundColor: Colors.secondary + '10' }]}>
                <Ionicons name="time-outline" size={18} color={Colors.secondary} />
              </View>
              <Text style={styles.infoValue}>{breed.care.lifespan.min}-{breed.care.lifespan.max}年</Text>
              <Text style={styles.infoLabel}>寿命</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <View style={[styles.infoIconWrap, { backgroundColor: Colors.accent + '10' }]}>
                <Ionicons name="cut-outline" size={18} color={Colors.accent} />
              </View>
              <Text style={styles.infoValue}>{breed.appearance.coatLength}</Text>
              <Text style={styles.infoLabel}>毛长</Text>
            </View>
          </View>
        </FadeInView>

        {/* 性格特征 */}
        <FadeInView delay={200} style={styles.section}>
          <Text style={styles.sectionTitle}>性格特征</Text>
          <View style={styles.temperamentCard}>
            {temperamentKeys.map((key, index) => {
              const value = breed.temperament[key];
              const barColor = temperamentColors[key];
              return (
                <View key={key} style={styles.temperamentRow}>
                  <Text style={styles.temperamentLabel}>{temperamentLabels[key]}</Text>
                  <AnimatedBar value={value} color={barColor} delay={300 + index * 80} />
                  <Text style={styles.temperamentValue}>{value}/5</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.keywordRow}>
            {breed.temperament.keywords.map((keyword, index) => (
              <View key={index} style={[styles.keywordTag, { backgroundColor: accentColor + '12' }]}>
                <Text style={[styles.keywordText, { color: accentColor }]}>{keyword}</Text>
              </View>
            ))}
          </View>
        </FadeInView>

        {/* 品种历史 */}
        <FadeInView delay={300} style={styles.section}>
          <Text style={styles.sectionTitle}>品种历史</Text>
          <View style={styles.bodyCard}>
            <View style={styles.historyDecorBar} />
            <Text style={[styles.bodyText, { paddingLeft: Spacing.sm }]}>{breed.history}</Text>
          </View>
        </FadeInView>

        {/* 外观特征 */}
        <FadeInView delay={350} style={styles.section}>
          <Text style={styles.sectionTitle}>外观特征</Text>
          <View style={styles.bodyCard}>
            <View style={styles.appearanceRow}>
              <View style={styles.appearanceItem}>
                <View style={styles.appearanceLabelRow}>
                  <Ionicons name="color-palette-outline" size={14} color={accentColor} />
                  <Text style={styles.appearanceLabel}>毛色</Text>
                </View>
                <Text style={[styles.appearanceValue, { paddingLeft: 20 }]}>{breed.appearance.coatColors.join('、')}</Text>
              </View>
              <View style={styles.appearanceDivider} />
              <View style={styles.appearanceItem}>
                <View style={styles.appearanceLabelRow}>
                  <Ionicons name="ear-outline" size={14} color={accentColor} />
                  <Text style={styles.appearanceLabel}>耳朵</Text>
                </View>
                <Text style={[styles.appearanceValue, { paddingLeft: 20 }]}>{breed.appearance.earShape}</Text>
              </View>
              <View style={styles.appearanceDivider} />
              <View style={styles.appearanceItem}>
                <View style={styles.appearanceLabelRow}>
                  <Ionicons name="body-outline" size={14} color={accentColor} />
                  <Text style={styles.appearanceLabel}>体型</Text>
                </View>
                <Text style={[styles.appearanceValue, { paddingLeft: 20 }]}>{breed.appearance.bodyShape}</Text>
              </View>
            </View>
          </View>
        </FadeInView>

        {/* 养护指南 */}
        <FadeInView delay={400} style={styles.section}>
          <Text style={styles.sectionTitle}>养护指南</Text>
          <View style={styles.careGrid}>
            <View style={styles.careItem}>
              <LinearGradient
                colors={[Colors.primary + '15', Colors.primary + '05']}
                style={styles.careIconWrap}
              >
                <Ionicons name="fitness" size={20} color={Colors.primary} />
              </LinearGradient>
              <Text style={styles.careValue}>{breed.care.exerciseNeeds}</Text>
              <Text style={styles.careLabel}>运动需求</Text>
            </View>
            <View style={styles.careItem}>
              <LinearGradient
                colors={[Colors.secondary + '15', Colors.secondary + '05']}
                style={styles.careIconWrap}
              >
                <Ionicons name="cut" size={20} color={Colors.secondary} />
              </LinearGradient>
              <Text style={styles.careValue}>{breed.care.groomingDifficulty}</Text>
              <Text style={styles.careLabel}>梳理难度</Text>
            </View>
            <View style={styles.careItem}>
              <LinearGradient
                colors={[Colors.accent + '15', Colors.accent + '05']}
                style={styles.careIconWrap}
              >
                <Ionicons name="leaf" size={20} color={Colors.accent} />
              </LinearGradient>
              <Text style={styles.careValue}>
                {'★'.repeat(breed.care.sheddingLevel)}{'☆'.repeat(5 - breed.care.sheddingLevel)}
              </Text>
              <Text style={styles.careLabel}>掉毛程度</Text>
            </View>
          </View>
        </FadeInView>

        {/* 常见疾病 */}
        <FadeInView delay={450} style={styles.section}>
          <Text style={styles.sectionTitle}>常见疾病</Text>
          {breed.care.commonDiseases.map((disease, index) => (
            <View key={index} style={styles.diseaseItem}>
              <View style={styles.diseaseIcon}>
                <Ionicons name="medical" size={14} color={Colors.accent} />
              </View>
              <Text style={styles.diseaseText}>{disease}</Text>
            </View>
          ))}
        </FadeInView>

        {/* 饮食建议 */}
        <FadeInView delay={500} style={styles.section}>
          <Text style={styles.sectionTitle}>饮食建议</Text>
          <View style={styles.bodyCard}>
            <View style={styles.dietIconRow}>
              <Ionicons name="nutrition-outline" size={16} color={Colors.primary} />
              <Text style={styles.dietHint}>饮食要点</Text>
            </View>
            <Text style={styles.bodyText}>{breed.care.dietaryNotes}</Text>
          </View>
        </FadeInView>

        {/* 适合人群 */}
        <FadeInView delay={550} style={styles.section}>
          <Text style={styles.sectionTitle}>适合人群</Text>
          <View style={styles.tagRow}>
            {breed.suitableFor.map((tag, index) => (
              <View key={index} style={styles.suitableTag}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                <Text style={styles.suitableText}>{tag}</Text>
              </View>
            ))}
          </View>
        </FadeInView>

        {/* 趣味冷知识 */}
        <FadeInView delay={600} style={styles.section}>
          <Text style={styles.sectionTitle}>趣味冷知识</Text>
          {breed.funFacts.map((fact, index) => (
            <View key={index} style={styles.factItem}>
              <LinearGradient
                colors={[accentColor + '15', accentColor + '05']}
                style={styles.factNumber}
              >
                <Text style={[styles.factNumberText, { color: accentColor }]}>{index + 1}</Text>
              </LinearGradient>
              <Text style={styles.factText}>{fact}</Text>
            </View>
          ))}
        </FadeInView>

        {/* 相关品种推荐 */}
        {relatedBreeds.length > 0 && (
          <FadeInView delay={650} style={styles.section}>
            <Text style={styles.sectionTitle}>相关{breed.species === 'cat' ? '猫咪' : '狗狗'}品种推荐</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {relatedBreeds.map((relatedBreed) => (
                <TouchableOpacity
                  key={relatedBreed.id}
                  style={styles.relatedCard}
                  onPress={() => handleRelatedBreedPress(relatedBreed.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.relatedImageWrap}>
                    {relatedBreed.imageUrl ? (
                      <OptimizedImage uri={relatedBreed.imageUrl} style={{ width: '100%', height: '100%' }} borderRadius={BorderRadius.md} />
                    ) : (
                      <View style={styles.relatedImagePlaceholder}>
                        <PetIllustration species={relatedBreed.species} size={60} color={accentColor} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.relatedName}>{relatedBreed.name}</Text>
                  <Text style={styles.relatedNameEn}>{relatedBreed.nameEn}</Text>
                  <View style={styles.relatedKeywords}>
                    {relatedBreed.temperament.keywords.slice(0, 2).map((keyword, i) => (
                      <View key={i} style={[styles.relatedKeywordTag, { backgroundColor: accentColor + '12' }]}>
                        <Text style={[styles.relatedKeywordText, { color: accentColor }]}>{keyword}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </FadeInView>
        )}

        {/* AI顾问入口 */}
        <FadeInView delay={700} style={styles.section}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/(tabs)/ai')}>
            <LinearGradient
              colors={[accentColor, accentColor + 'CC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.aiEntryCard}
            >
              <View style={styles.aiEntryLeft}>
                <View style={styles.aiIconCircle}>
                  <Ionicons name="sparkles" size={22} color={Colors.surface} />
                </View>
                <View>
                  <Text style={styles.aiEntryTitle}>问问 AI 顾问</Text>
                  <Text style={styles.aiEntryDesc}>了解更多关于{breed.name}的秘密</Text>
                </View>
              </View>
              <View style={styles.aiArrowCircle}>
                <Ionicons name="arrow-forward" size={18} color={accentColor} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </FadeInView>

        <View style={styles.scrollEndSpacer} />
      </Animated.ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
  },
  heroSection: {
    paddingBottom: Spacing.xxl,
  },
  heroSafeArea: {
    paddingHorizontal: Spacing.xl,
  },
  heroNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface + 'CC',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  heroActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface + 'CC',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  // 图片轮播
  carouselContainer: {
    marginBottom: Spacing.lg,
  },
  carouselSlide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationBg: {
    width: 220,
    height: 180,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  galleryImage: {
    width: 208,
    height: 168,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.md,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 18,
    borderRadius: 3,
  },
  // 品种信息
  heroInfo: {
    alignItems: 'center',
  },
  breedName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.5,
  },
  breedNameEn: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  originBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  originText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  sizeBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.xl,
  },
  sizeText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  coatBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.xl,
  },
  coatText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  section: {
    marginTop: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
    letterSpacing: 0.3,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: '#1D3557',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoValue: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  infoLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  infoDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  temperamentCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    shadowColor: '#1D3557',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  temperamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  temperamentLabel: {
    fontSize: FontSize.sm,
    color: Colors.text,
    width: 50,
    fontWeight: '500',
  },
  temperamentBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  temperamentFill: {
    height: '100%',
    borderRadius: 4,
  },
  temperamentValue: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    width: 30,
    textAlign: 'right',
  },
  keywordRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  keywordTag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.xl,
  },
  keywordText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  bodyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  historyDecorBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  bodyText: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 24,
  },
  appearanceRow: {
    gap: Spacing.md,
  },
  appearanceItem: {
    gap: 6,
  },
  appearanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appearanceLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  appearanceDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 2,
  },
  appearanceValue: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 22,
  },
  careGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  careItem: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
    shadowColor: '#1D3557',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  careIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  careLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  careValue: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  diseaseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  diseaseIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.accent + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  diseaseText: {
    fontSize: FontSize.md,
    color: Colors.text,
    flex: 1,
  },
  // 饮食建议
  dietIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  dietHint: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  suitableTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  suitableText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '500',
  },
  factItem: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  factNumber: {
    width: 28,
    height: 28,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  factNumberText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  factText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 22,
  },
  aiEntryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    ...Shadows.lg,
  },
  aiIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiArrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiEntryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  aiEntryTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.surface,
  },
  aiEntryDesc: {
    fontSize: FontSize.sm,
    color: Colors.surface + 'CC',
    marginTop: 2,
  },
  favoriteCountWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.md },
  favoriteCountText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  voiceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  voiceBarPlaying: {
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  voiceBarPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceBarPlayBtnPlaying: {
    backgroundColor: Colors.primary,
  },
  voiceBarInfo: { flex: 1 },
  voiceBarTitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  voiceBarTitlePlaying: { color: Colors.primary, fontWeight: '600' },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 20,
  },
  voiceWaveBar: {
    width: 3,
    height: 4,
    borderRadius: 1.5,
    backgroundColor: Colors.border,
  },
  voiceWaveBarActive: {
    borderRadius: 1.5,
  },
  relatedCard: {
    width: 150, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, marginRight: Spacing.md,
    padding: Spacing.md, ...Shadows.md,
  },
  relatedImageWrap: { width: '100%', height: 100, borderRadius: BorderRadius.md, overflow: 'hidden', marginBottom: Spacing.sm },
  relatedImage: { width: '100%', height: '100%' },
  relatedImagePlaceholder: { width: '100%', height: '100%', backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  relatedName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  relatedNameEn: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  relatedKeywords: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: Spacing.sm },
  relatedKeywordTag: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  relatedKeywordText: { fontSize: 10, fontWeight: '500' },
  /** 底部安全间距，避免内容被 tab bar 遮挡 */
  scrollEndSpacer: {
    height: 100,
  },
});
