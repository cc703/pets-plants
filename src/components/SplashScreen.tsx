import React, { useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Animated, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, Shadows } from '../utils/theme';
import PetIllustration from './PetIllustration';

interface SplashScreenProps {
  onFinish: () => void;
}

/** 启动闪屏组件 - 带入场动画的品牌展示 */
function SplashScreenInner({ onFinish }: SplashScreenProps) {
  const illustrationOpacity = useRef(new Animated.Value(0)).current;
  const humanX = useRef(new Animated.Value(-24)).current;
  const petX = useRef(new Animated.Value(24)).current;
  const connectorScale = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(0.7)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  // 使用 ref 保存 onFinish 引用，避免 useEffect 依赖变化导致动画重置
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    const isWeb = Platform.OS === 'web';

    // 安全超时：确保 splash 一定会被关闭，防止 Web 上动画回调不触发导致白屏
    const safetyTimeout = setTimeout(() => {
      onFinishRef.current();
    }, 4000);

    // 人与宠物相遇的入场动画
    Animated.sequence([
      Animated.parallel([
        Animated.timing(illustrationOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(humanX, {
          toValue: 0,
          duration: isWeb ? 420 : 520,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(petX, {
          toValue: 0,
          duration: isWeb ? 420 : 520,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(connectorScale, {
          toValue: 1,
          duration: 380,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(heartOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(heartScale, {
          toValue: 1,
          tension: 65,
          friction: 7,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(badgeOpacity, {
          toValue: 1,
          duration: 300,
          delay: 100,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 320,
        delay: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.delay(isWeb ? 700 : 900),
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      clearTimeout(safetyTimeout);
      onFinishRef.current();
    });

    return () => {
      clearTimeout(safetyTimeout);
    };
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <LinearGradient
        colors={[Colors.primary + '14', Colors.background, Colors.secondary + '10']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.scene}>
          <Animated.View style={[styles.illustrationCard, { opacity: illustrationOpacity }]}>
            <Image
              source={require('../../assets/splash/community-friendship.png')}
              style={styles.illustration}
              resizeMode="cover"
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.connector,
              { transform: [{ scaleX: connectorScale }] },
            ]}
          />

          <Animated.View
            style={[
              styles.humanWrap,
              { transform: [{ translateX: humanX }] },
            ]}
          >
            <View style={[styles.avatarCircle, styles.humanCircle]}>
              <Ionicons name="person" size={38} color={Colors.primaryDark} />
            </View>
            <Text style={styles.figureLabel}>我</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.heartWrap,
              {
                opacity: heartOpacity,
                transform: [{ scale: heartScale }],
              },
            ]}
          >
            <View style={styles.heartOrb}>
              <Ionicons name="heart" size={26} color={Colors.accent} />
            </View>
            <Animated.View style={[styles.badgePill, { opacity: badgeOpacity }]}>
              <Text style={styles.badgeText}>陪伴</Text>
            </Animated.View>
          </Animated.View>

          <Animated.View
            style={[
              styles.petWrap,
              { transform: [{ translateX: petX }] },
            ]}
          >
            <View style={[styles.avatarCircle, styles.petCircle]}>
              <View style={styles.petPair}>
                <PetIllustration species="cat" size={34} color={Colors.primary} />
                <PetIllustration species="dog" size={34} color={Colors.secondary} />
              </View>
            </View>
            <Text style={styles.figureLabel}>猫狗</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.textWrap, { opacity: textOpacity }]}>
          <Text style={styles.title}>萌宠星球</Text>
          <Text style={styles.subtitle}>宠物社区 · 品种百科</Text>
          <View style={styles.taglineWrap}>
            <Text style={styles.tagline}>认识更多品种，记录每一次相遇</Text>
          </View>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scene: {
    width: 300,
    height: 220,
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  illustrationCard: {
    position: 'absolute',
    width: 250,
    height: 160,
    borderRadius: 30,
    overflow: 'hidden',
    opacity: 0.76,
    ...Shadows.md,
  },
  illustration: {
    width: '100%',
    height: '100%',
  },
  connector: {
    position: 'absolute',
    width: 150,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.primary + '55',
    top: 106,
  },
  humanWrap: {
    position: 'absolute',
    left: 4,
    top: 58,
    alignItems: 'center',
  },
  petWrap: {
    position: 'absolute',
    right: 4,
    top: 54,
    alignItems: 'center',
  },
  avatarCircle: {
    width: 92,
    height: 92,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.lg,
  },
  humanCircle: {
    backgroundColor: '#FFFFFF',
  },
  petCircle: {
    backgroundColor: Colors.primary + '10',
  },
  petPair: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -4,
  },
  figureLabel: {
    marginTop: 8,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  heartWrap: {
    position: 'absolute',
    top: 58,
    alignItems: 'center',
  },
  heartOrb: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  badgePill: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.accent + '12',
  },
  badgeText: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: '700',
    letterSpacing: 1,
  },
  textWrap: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: 4,
    letterSpacing: 1,
  },
  taglineWrap: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: Colors.primary + '12',
    borderRadius: 20,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: Colors.primaryDark,
    fontWeight: '600',
    letterSpacing: 1,
  },
});

const SplashScreen = memo(SplashScreenInner);
SplashScreen.displayName = 'SplashScreen';
export default SplashScreen;
