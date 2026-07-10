import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ensureLoggedIn, safeBack } from '../src/utils/nav';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../src/utils/theme';
import { pointsService } from '../src/services/pointsService';
import { useAuth } from '../src/contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ShopItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  price: number;
  category: 'virtual' | 'coupon' | 'theme' | 'gift';
  hot?: boolean;
  tag?: string;
}

const shopItems: ShopItem[] = [
  { id: 'feed-1', name: '高级猫粮', description: '虚拟宠物快乐度+20', icon: '🐟', price: 50, category: 'virtual', hot: true, tag: '人气' },
  { id: 'feed-2', name: '磨牙棒', description: '虚拟宠物健康度+15', icon: '🦴', price: 30, category: 'virtual' },
  { id: 'toy-1', name: '逗猫棒', description: '虚拟宠物快乐度+10', icon: '🪶', price: 20, category: 'virtual' },
  { id: 'toy-2', name: '飞盘', description: '虚拟宠物健康度+10', icon: '🥏', price: 20, category: 'virtual' },
  { id: 'theme-1', name: '星空主题', description: '解锁星空背景主题', icon: '🌙', price: 200, category: 'theme', tag: '限时' },
  { id: 'theme-2', name: '森林主题', description: '解锁森林背景主题', icon: '🌲', price: 200, category: 'theme' },
  { id: 'coupon-1', name: '9折优惠券', description: '商城购物享9折', icon: '🎫', price: 100, category: 'coupon', hot: true },
  { id: 'coupon-2', name: '免邮券', description: '商城购物免运费', icon: '📦', price: 80, category: 'coupon' },
  { id: 'gift-1', name: '头像框·萌爪', description: '限定萌爪头像框', icon: '🖼️', price: 300, category: 'gift', tag: '限定' },
  { id: 'gift-2', name: '称号·养宠达人', description: '个人主页展示称号', icon: '🏅', price: 500, category: 'gift' },
];

const categories = [
  { key: 'all' as const, label: '全部', icon: 'apps' as const },
  { key: 'virtual' as const, label: '虚拟用品', icon: 'paw' as const },
  { key: 'theme' as const, label: '主题', icon: 'color-palette' as const },
  { key: 'coupon' as const, label: '优惠券', icon: 'ticket' as const },
  { key: 'gift' as const, label: '限定', icon: 'gift' as const },
];

const categoryColors: Record<string, string> = {
  virtual: Colors.primary,
  theme: '#9B5DE5',
  coupon: Colors.secondary,
  gift: Colors.accent,
};

export default function PointsShopPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [checkedIn, setCheckedIn] = useState(false);

  useEffect(() => {
    pointsService.getSummary().then((s) => {
      setPoints(s.points);
      setCheckedIn(s.checkedInToday);
    }).finally(() => setLoading(false));
  }, []);

  const handleCheckIn = useCallback(async () => {
    if (!ensureLoggedIn(!!user, '签到')) return;
    if (checkedIn) return;
    try {
      const result = await pointsService.checkIn();
      if (result.pointsEarned > 0) {
        setCheckedIn(true);
        setPoints((p) => p + result.pointsEarned);
        Alert.alert('签到成功', `获得 ${result.pointsEarned} 积分`);
      } else {
        Alert.alert('提示', result.message);
      }
    } catch {
      Alert.alert('提示', '签到失败，请重试');
    }
  }, [user, checkedIn, router]);

  const handleBuy = useCallback((item: ShopItem) => {
    if (!ensureLoggedIn(!!user, '积分兑换')) return;
    if (points < item.price) {
      Alert.alert('积分不足', `兑换「${item.name}」需要 ${item.price} 积分，当前仅有 ${points} 积分`);
      return;
    }
    Alert.alert(
      '确认兑换',
      `使用 ${item.price} 积分兑换「${item.name}」？当前商城为虚拟道具兑换，不涉及真实商品发货。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '兑换',
          onPress: async () => {
            const ok = await pointsService.spendPoints(item.price, `兑换${item.name}`);
            if (ok) {
              setPoints((p) => p - item.price);
              Alert.alert('兑换成功', `已成功兑换「${item.name}」，可用于虚拟宠物或个人展示。`);
            } else {
              Alert.alert('兑换失败', '积分不足或网络异常');
            }
          },
        },
      ],
    );
  }, [user, points, router]);

  const filtered = activeCategory === 'all'
    ? shopItems
    : shopItems.filter((i) => i.category === activeCategory);

  const hotItems = shopItems.filter((i) => i.hot);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero Points Card */}
        <LinearGradient
          colors={[Colors.primaryDark, Colors.primary, '#45B7AA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <TouchableOpacity onPress={() => safeBack()} style={styles.heroBack}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>我的积分</Text>
            <TouchableOpacity style={styles.heroHistoryBtn} onPress={() => Alert.alert('提示', '积分明细功能即将上线')}>
              <Text style={styles.heroHistoryText}>明细</Text>
              <Ionicons name="chevron-forward" size={12} color="#FFFFFFBB" />
            </TouchableOpacity>
          </View>
          <Text style={styles.heroPoints}>{points.toLocaleString()}</Text>
          <Text style={styles.heroHint}>仅用于虚拟道具、主题和展示权益兑换</Text>
          <View style={styles.heroDecor}>
            <View style={[styles.heroDecorCircle, { top: 20, right: 30, width: 80, height: 80, opacity: 0.1 }]} />
            <View style={[styles.heroDecorCircle, { top: -20, right: -10, width: 50, height: 50, opacity: 0.15 }]} />
            <View style={[styles.heroDecorCircle, { bottom: 10, right: 60, width: 30, height: 30, opacity: 0.12 }]} />
          </View>
        </LinearGradient>

        {/* Check-in Bar */}
        <TouchableOpacity
          style={[styles.checkInBar, checkedIn && styles.checkInBarDone]}
          activeOpacity={0.85}
          onPress={handleCheckIn}
        >
          <View style={styles.checkInLeft}>
            <View style={[styles.checkInIconWrap, checkedIn && { backgroundColor: Colors.success + '15' }]}>
              <Ionicons name={checkedIn ? 'checkmark-circle' : 'calendar'} size={22} color={checkedIn ? Colors.success : Colors.primary} />
            </View>
            <View>
              <Text style={[styles.checkInTitle, checkedIn && { color: Colors.success }]}>
                {checkedIn ? '今日已签到' : '每日签到'}
              </Text>
              <Text style={styles.checkInDesc}>{checkedIn ? '明天再来继续加油' : '+10 积分'}</Text>
            </View>
          </View>
          <View style={[styles.checkInBtn, checkedIn && styles.checkInBtnDone]}>
            <Text style={[styles.checkInBtnText, checkedIn && { color: Colors.success }]}>
              {checkedIn ? '已签到' : '签到'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Hot Items Horizontal Scroll */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="flame" size={20} color={Colors.accent} />
              <Text style={styles.sectionTitle}>热门推荐</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.sectionMore}>查看全部</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hotScroll}>
            {hotItems.map((item) => (
              <TouchableOpacity key={item.id} style={styles.hotCard} activeOpacity={0.85} onPress={() => handleBuy(item)}>
                <LinearGradient
                  colors={[categoryColors[item.category] + '12', categoryColors[item.category] + '06']}
                  style={styles.hotCardInner}
                >
                  <Text style={styles.hotCardIcon}>{item.icon}</Text>
                  <Text style={styles.hotCardName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.hotCardDesc} numberOfLines={1}>{item.description}</Text>
                  <View style={styles.hotCardPrice}>
                    <Ionicons name="star" size={12} color={Colors.secondary} />
                    <Text style={styles.hotCardPriceText}>{item.price}</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Category Tabs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>全部商品</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
            {categories.map((c) => {
              const isActive = activeCategory === c.key;
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setActiveCategory(c.key)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={c.icon}
                    size={14}
                    color={isActive ? '#FFFFFF' : Colors.textSecondary}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Items Grid */}
        <View style={styles.gridWrap}>
          {filtered.map((item, index) => {
            const canBuy = user && points >= item.price;
            const catColor = categoryColors[item.category] || Colors.primary;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.itemCard}
                activeOpacity={0.85}
                onPress={() => handleBuy(item)}
              >
                {item.tag && (
                  <View style={[styles.itemTag, { backgroundColor: catColor }]}>
                    <Text style={styles.itemTagText}>{item.tag}</Text>
                  </View>
                )}
                <View style={[styles.itemIconWrap, { backgroundColor: catColor + '10' }]}>
                  <Text style={styles.itemIcon}>{item.icon}</Text>
                </View>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
                <View style={styles.itemBottom}>
                  <View style={styles.priceRow}>
                    <Ionicons name="star" size={14} color={Colors.secondary} />
                    <Text style={[styles.priceText, !canBuy && { color: Colors.textLight }]}>{item.price}</Text>
                  </View>
                  <View style={[styles.buyBtn, canBuy ? { backgroundColor: catColor } : styles.buyBtnDisabled]}>
                    <Text style={[styles.buyBtnText, !canBuy && styles.buyBtnTextDisabled]}>
                      {canBuy ? '兑换' : '不足'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Hero card
  heroCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingTop: 50,
    paddingBottom: Spacing.xxl,
    overflow: 'hidden',
  },
  heroBack: { position: 'absolute', top: 12, left: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF18', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  heroLabel: { fontSize: FontSize.md, color: '#FFFFFFCC', fontWeight: '500' },
  heroHistoryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full },
  heroHistoryText: { fontSize: FontSize.xs, color: '#FFFFFF', marginRight: 2 },
  heroPoints: { fontSize: 40, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1 },
  heroHint: { fontSize: FontSize.xs, color: '#FFFFFFCC', marginTop: 4 },
  heroDecor: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  heroDecorCircle: { position: 'absolute', borderRadius: 999, backgroundColor: '#FFFFFF' },

  // Check-in
  checkInBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  checkInBarDone: { opacity: 0.8 },
  checkInLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  checkInIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  checkInTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  checkInDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  checkInBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  checkInBtnDone: { backgroundColor: Colors.success + '15' },
  checkInBtnText: { fontSize: FontSize.sm, color: '#FFFFFF', fontWeight: '600' },

  // Section
  section: { marginTop: Spacing.xxl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: Spacing.xl, marginBottom: Spacing.md },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  sectionMore: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // Hot items
  hotScroll: { paddingLeft: Spacing.xl, paddingRight: Spacing.sm, gap: Spacing.md },
  hotCard: { width: SCREEN_WIDTH * 0.36, ...Shadows.sm, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  hotCardInner: { padding: Spacing.lg, alignItems: 'center', borderRadius: BorderRadius.lg },
  hotCardIcon: { fontSize: 36, marginBottom: Spacing.sm },
  hotCardName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  hotCardDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.sm },
  hotCardPrice: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  hotCardPriceText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.secondary },

  // Tabs
  tabsScroll: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: '#FFFFFF' },

  // Grid
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.xl, gap: Spacing.md, marginTop: Spacing.md },
  itemCard: {
    width: (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  itemTag: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderBottomLeftRadius: BorderRadius.sm,
    borderTopRightRadius: BorderRadius.lg,
  },
  itemTagText: { fontSize: 10, color: '#FFFFFF', fontWeight: '600' },
  itemIconWrap: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  itemIcon: { fontSize: 32 },
  itemName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  itemDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.md },
  itemBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.secondary },
  buyBtn: { paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: BorderRadius.full },
  buyBtnDisabled: { backgroundColor: Colors.border },
  buyBtnText: { fontSize: FontSize.xs, color: '#FFFFFF', fontWeight: '600' },
  buyBtnTextDisabled: { color: Colors.textLight },
});
