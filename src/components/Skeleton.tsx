import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, DimensionValue } from 'react-native';
import { Colors, BorderRadius } from '../utils/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: any;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 6, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: Colors.border, opacity },
        style,
      ]}
    />
  );
}

export function BreedDetailSkeleton() {
  return (
    <View style={styles.container}>
      {/* Hero image skeleton */}
      <Skeleton width="100%" height={260} borderRadius={0} />

      <View style={styles.content}>
        {/* Title row */}
        <View style={styles.row}>
          <Skeleton width={160} height={28} />
          <Skeleton width={60} height={24} borderRadius={12} />
        </View>
        <Skeleton width={120} height={16} style={{ marginTop: 8 }} />

        {/* Tags */}
        <View style={styles.tagRow}>
          <Skeleton width={64} height={28} borderRadius={14} />
          <Skeleton width={80} height={28} borderRadius={14} />
          <Skeleton width={56} height={28} borderRadius={14} />
        </View>

        {/* Section blocks */}
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.section}>
            <Skeleton width={100} height={20} style={{ marginBottom: 12 }} />
            <Skeleton width="100%" height={14} />
            <Skeleton width="85%" height={14} style={{ marginTop: 8 }} />
            <Skeleton width="70%" height={14} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="100%" height={120} borderRadius={12} />
      <Skeleton width="70%" height={18} style={{ marginTop: 10 }} />
      <Skeleton width="50%" height={14} style={{ marginTop: 6 }} />
    </View>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  section: {
    marginTop: 24,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 12,
    marginBottom: 12,
  },
});
