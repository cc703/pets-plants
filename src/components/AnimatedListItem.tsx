import React, { useRef, useEffect } from 'react';
import { Animated, Platform, ViewStyle } from 'react-native';

interface AnimatedListItemProps {
  children: React.ReactNode;
  index: number;
  delay?: number;
  duration?: number;
  style?: ViewStyle;
}

export default function AnimatedListItem({
  children,
  index,
  delay = 100,
  duration = 400,
  style,
}: AnimatedListItemProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const isWeb = Platform.OS === 'web';

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration,
        delay: index * delay,
        useNativeDriver: !isWeb,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay: index * delay,
        useNativeDriver: !isWeb,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        {
          opacity: fadeAnim,
          transform: [{ translateY }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
