import React, { memo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';
import type { Species } from '../types';

interface PetIllustrationProps {
  species: Species;
  size?: number;
  color?: string;
}

/** Q版猫咪线条插画 - 用SVG路径绘制可爱的猫咪轮廓 */
const CatSVG = memo<{ size: number; color: string }>(({ size, color }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
    {/* 左耳 */}
    <Path
      d="M30 45 L22 18 L42 35 Z"
      stroke={color}
      strokeWidth={2.5}
      strokeLinejoin="round"
      fill={color + '10'}
    />
    {/* 右耳 */}
    <Path
      d="M90 45 L98 18 L78 35 Z"
      stroke={color}
      strokeWidth={2.5}
      strokeLinejoin="round"
      fill={color + '10'}
    />
    {/* 头部 */}
    <Ellipse
      cx={60}
      cy={52}
      rx={32}
      ry={28}
      stroke={color}
      strokeWidth={2.5}
      fill={color + '08'}
    />
    {/* 左眼 - 半闭的慵懒眼 */}
    <Path
      d="M44 48 Q48 44 52 48"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      fill="none"
    />
    <Circle cx={48} cy={50} r={1.5} fill={color} />
    {/* 右眼 */}
    <Path
      d="M68 48 Q72 44 76 48"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      fill="none"
    />
    <Circle cx={72} cy={50} r={1.5} fill={color} />
    {/* 鼻子 */}
    <Path
      d="M58 56 L60 58 L62 56"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={color + '30'}
    />
    {/* 嘴巴 */}
    <Path
      d="M60 58 Q56 62 54 60"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      fill="none"
    />
    <Path
      d="M60 58 Q64 62 66 60"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      fill="none"
    />
    {/* 左胡须 */}
    <Path d="M54 55 L30 52" stroke={color} strokeWidth={1.2} strokeLinecap="round" opacity={0.5} />
    <Path d="M54 57 L32 58" stroke={color} strokeWidth={1.2} strokeLinecap="round" opacity={0.5} />
    {/* 右胡须 */}
    <Path d="M66 55 L90 52" stroke={color} strokeWidth={1.2} strokeLinecap="round" opacity={0.5} />
    <Path d="M66 57 L88 58" stroke={color} strokeWidth={1.2} strokeLinecap="round" opacity={0.5} />
    {/* 身体 */}
    <Ellipse
      cx={60}
      cy={88}
      rx={24}
      ry={20}
      stroke={color}
      strokeWidth={2.5}
      fill={color + '08'}
    />
    {/* 前爪左 */}
    <Ellipse cx={48} cy={104} rx={8} ry={5} stroke={color} strokeWidth={2} fill={color + '10'} />
    {/* 前爪右 */}
    <Ellipse cx={72} cy={104} rx={8} ry={5} stroke={color} strokeWidth={2} fill={color + '10'} />
    {/* 尾巴 */}
    <Path
      d="M84 85 Q100 75 105 55 Q108 45 100 42"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      fill="none"
    />
  </Svg>
));
CatSVG.displayName = 'CatSVG';

/** Q版狗狗线条插画 - 用SVG路径绘制可爱的狗狗轮廓 */
const DogSVG = memo<{ size: number; color: string }>(({ size, color }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
    {/* 左耳 - 下垂 */}
    <Path
      d="M30 42 Q18 35 15 50 Q12 65 25 62"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      fill={color + '10'}
    />
    {/* 右耳 - 下垂 */}
    <Path
      d="M90 42 Q102 35 105 50 Q108 65 95 62"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      fill={color + '10'}
    />
    {/* 头部 */}
    <Ellipse
      cx={60}
      cy={48}
      rx={30}
      ry={26}
      stroke={color}
      strokeWidth={2.5}
      fill={color + '08'}
    />
    {/* 左眼 - 圆圆的 */}
    <Circle cx={46} cy={44} r={5} stroke={color} strokeWidth={2} fill={color + '15'} />
    <Circle cx={47} cy={43} r={2} fill={color} />
    {/* 右眼 */}
    <Circle cx={74} cy={44} r={5} stroke={color} strokeWidth={2} fill={color + '15'} />
    <Circle cx={75} cy={43} r={2} fill={color} />
    {/* 鼻子 */}
    <Ellipse cx={60} cy={55} rx={6} ry={4} fill={color} />
    {/* 嘴巴 */}
    <Path
      d="M60 59 Q55 64 52 62"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      fill="none"
    />
    <Path
      d="M60 59 Q65 64 68 62"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      fill="none"
    />
    {/* 舌头 */}
    <Path
      d="M58 62 Q60 70 62 62"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      fill={color + '40'}
    />
    {/* 身体 */}
    <Ellipse
      cx={60}
      cy={88}
      rx={26}
      ry={22}
      stroke={color}
      strokeWidth={2.5}
      fill={color + '08'}
    />
    {/* 前爪左 */}
    <Ellipse cx={46} cy={106} rx={9} ry={5} stroke={color} strokeWidth={2} fill={color + '10'} />
    {/* 前爪右 */}
    <Ellipse cx={74} cy={106} rx={9} ry={5} stroke={color} strokeWidth={2} fill={color + '10'} />
    {/* 尾巴 - 摇摆的 */}
    <Path
      d="M86 82 Q102 70 108 55 Q112 45 105 40"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      fill="none"
    />
    {/* 项圈 */}
    <Path
      d="M42 68 Q60 72 78 68"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      fill="none"
      opacity={0.4}
    />
  </Svg>
));
DogSVG.displayName = 'DogSVG';

/** Web 安全包装：SVG 渲染失败时回退到 emoji */
class SvgErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const EmojiFallback = memo<{ species: Species; size: number }>(({ species, size }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ fontSize: size * 0.6 }}>{species === 'cat' ? '🐱' : '🐶'}</Text>
  </View>
));
EmojiFallback.displayName = 'EmojiFallback';

/** 宠物 Q 版插画 - 支持猫/狗 SVG 绘制，失败时回退 emoji */
function PetIllustrationInner({ species, size = 80, color = '#6EC89B' }: PetIllustrationProps) {
  return (
    <SvgErrorBoundary fallback={<EmojiFallback species={species} size={size} />}>
      <View style={{ width: size, height: size }}>
        {species === 'cat' ? (
          <CatSVG size={size} color={color} />
        ) : (
          <DogSVG size={size} color={color} />
        )}
      </View>
    </SvgErrorBoundary>
  );
}

const PetIllustration = memo(PetIllustrationInner);
PetIllustration.displayName = 'PetIllustration';
export default PetIllustration;
