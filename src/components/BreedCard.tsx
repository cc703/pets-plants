import React, { memo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, FontSize, getAccentColor, getSpeciesGradient } from '../utils/theme';
import type { Breed } from '../types';
import PetIllustration from './PetIllustration';
import OptimizedImage from './OptimizedImage';

interface BreedCardProps {
  breed: Breed;
  onPress: () => void;
  index?: number;
}

/** 品种卡片组件 - 展示品种概要信息 */
function BreedCardInner({ breed, onPress, index = 0 }: BreedCardProps) {
  const accentColor = getAccentColor(breed.species);
  const gradientColors = getSpeciesGradient(breed.species);
  const isCat = breed.species === 'cat';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    const isWeb = Platform.OS === 'web';

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        useNativeDriver: !isWeb,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 400,
        delay: index * 80,
        useNativeDriver: !isWeb,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX }] }}>
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
        <LinearGradient
          colors={gradientColors as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          <View style={styles.cardContent}>
            <View style={[styles.avatarContainer, { backgroundColor: accentColor + '12' }]}>
              {breed.imageUrl ? (
                <OptimizedImage
                  uri={breed.imageUrl}
                  fallbackUris={breed.gallery}
                  style={{ width: 68, height: 68 }}
                  borderRadius={BorderRadius.lg}
                />
              ) : (
                <PetIllustration
                  species={breed.species}
                  size={56}
                  color={accentColor}
                />
              )}
            </View>
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{breed.name}</Text>
                <View style={[styles.speciesBadge, { backgroundColor: accentColor + '15' }]}>
                  <Text style={[styles.speciesBadgeText, { color: accentColor }]}>
                    {isCat ? '猫' : '狗'}
                  </Text>
                </View>
              </View>
              <Text style={styles.nameEn}>{breed.nameEn}</Text>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={12} color={Colors.textSecondary} />
                  <Text style={styles.metaText}>{breed.originCountry}</Text>
                </View>
                <View style={styles.metaDot} />
                <View style={styles.metaItem}>
                  <Ionicons name="resize-outline" size={12} color={Colors.textSecondary} />
                  <Text style={styles.metaText}>{breed.appearance.size}</Text>
                </View>
                <View style={styles.metaDot} />
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
                  <Text style={styles.metaText}>{breed.care.lifespan.min}-{breed.care.lifespan.max}年</Text>
                </View>
              </View>
              <View style={styles.tagRow}>
                {breed.temperament.keywords.slice(0, 3).map((tag, index) => (
                  <View key={index} style={[styles.tag, { backgroundColor: accentColor + '12' }]}>
                    <Text style={[styles.tagText, { color: accentColor }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.arrowContainer}>
              <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    shadowColor: '#1D3557',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  cardGradient: {
    borderRadius: BorderRadius.lg,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  avatarContainer: {
    width: 68,
    height: 68,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.3,
  },
  speciesBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  speciesBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  nameEn: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textLight,
    marginHorizontal: Spacing.sm,
  },
  metaText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  tagRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  tag: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  tagText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  arrowContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
});

/** 品种卡片 - 使用 React.memo 避免列表中不必要的重渲染 */
const BreedCard = memo(BreedCardInner);
export default BreedCard;
