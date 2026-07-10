import type { Species } from '../types';

// 清新自然系配色方案
export const Colors = {
  primary: '#6EC89B',      // 薄荷绿
  primaryLight: '#A8E6CF', // 浅薄荷
  primaryDark: '#4A9E75',  // 深薄荷
  secondary: '#F4A261',    // 杏仁橘
  secondaryLight: '#F8C89A',
  accent: '#E76F51',       // 赤陶红
  background: '#F0F7F4',   // 极淡薄荷
  surface: '#FFFFFF',      // 纯白
  card: '#FFFFFF',
  text: '#1D3557',         // 深海蓝
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
  success: '#4CD964',
  warning: '#FF9500',
  error: '#FF3B30',
  shadow: 'rgba(0, 0, 0, 0.06)',
  overlay: 'rgba(29, 53, 87, 0.4)',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  title: 28,
} as const;

// 统一阴影样式
export const Shadows = {
  sm: {
    shadowColor: '#1D3557',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: '#1D3557',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  lg: {
    shadowColor: '#1D3557',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
};

// 统一按钮样式
export const ButtonStyles = {
  primary: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  secondary: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  pill: {
    backgroundColor: Colors.primary + '12',
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
  },
};

// 统一卡片样式
export const CardStyles = {
  standard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  elevated: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  flat: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
};

/**
 * 根据物种返回对应的强调色
 * @param species - 'cat' 或 'dog'
 * @returns 主题色值
 */
export const getAccentColor = (species: Species): string => {
  return species === 'cat' ? Colors.primary : Colors.secondary;
};

/**
 * 根据物种返回渐变色数组（用于 LinearGradient）
 * @param species - 'cat' 或 'dog'
 * @returns 二元渐变色组
 */
export const getSpeciesGradient = (species: Species): [string, string] => {
  const base = species === 'cat' ? Colors.primary : Colors.secondary;
  return [base + '08', base + '03'];
};
