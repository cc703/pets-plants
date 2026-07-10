import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../utils/theme';

interface OptimizedImageProps {
  uri: string;
  fallbackUris?: string[];
  style?: any;
  borderRadius?: number;
  placeholderColor?: string;
  maxRetries?: number;
}

export default function OptimizedImage({
  uri,
  fallbackUris = [],
  style,
  borderRadius = 12,
  placeholderColor = Colors.border,
  maxRetries = 3,
}: OptimizedImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [sourceIndex, setSourceIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const ImageComponent = Platform.OS === 'web' ? require('react-native').Image : require('react-native').Image;
  const sources = [uri, ...fallbackUris.filter((item) => item && item !== uri)];
  const activeUri = sources[sourceIndex] || uri;

  useEffect(() => {
    setSourceIndex(0);
    setRetryCount(0);
    setStatus('loading');
    fadeAnim.setValue(0);
  }, [uri]);

  useEffect(() => {
    if (status === 'loading') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [status]);

  const handleLoad = useCallback(() => {
    setStatus('loaded');
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, []);

  const handleError = useCallback(() => {
    if (sourceIndex < sources.length - 1) {
      setSourceIndex((prev) => prev + 1);
      setRetryCount(0);
      setStatus('loading');
      fadeAnim.setValue(0);
      return;
    }
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      setStatus('loading');
    } else {
      setStatus('error');
    }
  }, [sourceIndex, sources.length, retryCount, maxRetries]);

  const handleRetry = useCallback(() => {
    setRetryCount(0);
    setStatus('loading');
    fadeAnim.setValue(0);
  }, []);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={[styles.container, { borderRadius }, style]}>
      {status === 'loading' && (
        <Animated.View
          style={[
            styles.placeholder,
            {
              backgroundColor: placeholderColor,
              opacity: shimmerOpacity,
              borderRadius,
            } as any,
          ]}
        >
          <ActivityIndicator size="small" color={Colors.primary} />
        </Animated.View>
      )}

      {status === 'error' ? (
        <View style={[styles.errorContainer, { borderRadius }]}>
          <Ionicons name="image-outline" size={24} color={Colors.textLight} />
          <Text style={styles.errorText}>加载失败</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
            <Ionicons name="refresh" size={14} color={Colors.primary} />
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.Image
          source={{ uri: retryCount > 0 ? `${activeUri}?retry=${retryCount}` : activeUri }}
          style={[
            styles.image,
            { borderRadius, opacity: status === 'loaded' ? fadeAnim : 0 },
          ]}
          onLoad={handleLoad}
          onError={handleError}
          resizeMode="cover"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.primary + '15',
    borderRadius: 12,
  },
  retryText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
});
