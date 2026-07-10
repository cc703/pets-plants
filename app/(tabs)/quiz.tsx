import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, Shadows, CardStyles } from '../../src/utils/theme';
import { safeBack } from '../../src/utils/nav';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  categoryNames,
  categoryIcons,
  categoryColors,
} from '../../src/data/quizzes';
import type { QuizCategory, LeaderboardEntry } from '../../src/types';
import {
  getUserQuizStats,
  getLeaderboard,
  getUserRank,
  hasCompletedDailyChallenge,
  getUserPoints,
} from '../../src/services/quizService';

const { width } = Dimensions.get('window');

export default function QuizScreen() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    totalCorrect: 0,
    totalQuestions: 0,
    totalPoints: 0,
    correctRate: 0,
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState(0);
  const [dailyCompleted, setDailyCompleted] = useState(false);

  const loadData = useCallback(() => {
    (async () => {
      if (user) {
        const userStats = await getUserQuizStats(user.id);
        setStats(userStats);
        setUserRank(getUserRank(user.id));
        setDailyCompleted(await hasCompletedDailyChallenge(user.id));
      } else {
        setStats({
          totalQuizzes: 0,
          totalCorrect: 0,
          totalQuestions: 0,
          totalPoints: 0,
          correctRate: 0,
        });
        setUserRank(0);
        setDailyCompleted(false);
      }
      setLeaderboard(getLeaderboard());
    })().catch(() => {});
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
    setTimeout(() => setRefreshing(false), 500);
  }, [loadData]);

  const handleCategoryPress = (category: QuizCategory) => {
    router.push({
      pathname: '/quiz/play',
      params: { mode: 'category', category },
    });
  };

  const handleDailyChallenge = () => {
    if (dailyCompleted) return;
    router.push({
      pathname: '/quiz/play',
      params: { mode: 'daily' },
    });
  };

  const categories: QuizCategory[] = ['breed', 'health', 'behavior', 'funfact'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 头部 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={safeBack} style={{ marginRight: 8 }}>
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>知识答题</Text>
          <Text style={styles.subtitle}>测试你的宠物知识吧！</Text>
        </View>

        {/* 积分统计卡片 */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalPoints}</Text>
              <Text style={styles.statLabel}>总积分</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalQuizzes}</Text>
              <Text style={styles.statLabel}>答题次数</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.correctRate}%</Text>
              <Text style={styles.statLabel}>正确率</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>第{userRank}名</Text>
              <Text style={styles.statLabel}>我的排名</Text>
            </View>
          </View>
        </View>

        {/* 每日挑战 */}
        <TouchableOpacity
          style={[styles.dailyCard, dailyCompleted && styles.dailyCardCompleted]}
          onPress={handleDailyChallenge}
          activeOpacity={dailyCompleted ? 1 : 0.7}
          disabled={dailyCompleted}
        >
          <View style={styles.dailyContent}>
            <View style={styles.dailyLeft}>
              <View style={styles.dailyIconContainer}>
                <Ionicons name="trophy" size={28} color="#FFD700" />
              </View>
              <View>
                <Text style={styles.dailyTitle}>每日挑战</Text>
                <Text style={styles.dailySubtitle}>
                  {dailyCompleted ? '今日已完成' : '随机10题，挑战自我'}
                </Text>
              </View>
            </View>
            <View style={styles.dailyRight}>
              {dailyCompleted ? (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                  <Text style={styles.completedText}>已完成</Text>
                </View>
              ) : (
                <View style={styles.startButton}>
                  <Text style={styles.startButtonText}>开始挑战</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </View>
              )}
            </View>
          </View>
          {!dailyCompleted && (
            <View style={styles.dailyReward}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.dailyRewardText}>完成可获得额外积分奖励</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* 分类卡片 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>答题分类</Text>
          <Text style={styles.sectionSubtitle}>选择你擅长的领域</Text>
        </View>

        <View style={styles.categoriesGrid}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={styles.categoryCard}
              onPress={() => handleCategoryPress(category)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.categoryIconContainer,
                  { backgroundColor: categoryColors[category] + '15' },
                ]}
              >
                <Ionicons
                  name={categoryIcons[category] as any}
                  size={32}
                  color={categoryColors[category]}
                />
              </View>
              <Text style={styles.categoryName}>{categoryNames[category]}</Text>
              <Text style={styles.categoryCount}>15题</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 排行榜 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>答题排行榜</Text>
          <Text style={styles.sectionSubtitle}>本周积分排行</Text>
        </View>

        <View style={styles.leaderboardCard}>
          {leaderboard.slice(0, 10).map((entry, index) => (
            <View
              key={entry.userId}
              style={[
                styles.leaderboardItem,
                index < leaderboard.length - 1 && styles.leaderboardItemBorder,
              ]}
            >
              <View style={styles.leaderboardRank}>
                {index < 3 ? (
                  <View
                    style={[
                      styles.medalBadge,
                      {
                        backgroundColor:
                          index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32',
                      },
                    ]}
                  >
                    <Text style={styles.medalText}>{index + 1}</Text>
                  </View>
                ) : (
                  <Text style={styles.rankText}>{index + 1}</Text>
                )}
              </View>

              <View style={styles.leaderboardAvatar}>
                <Ionicons name="person-circle" size={36} color={Colors.textLight} />
              </View>

              <View style={styles.leaderboardInfo}>
                <Text style={styles.leaderboardName}>{entry.nickname}</Text>
                <Text style={styles.leaderboardMeta}>
                  {entry.quizCount}次答题 · 正确率{entry.correctRate}%
                </Text>
              </View>

              <View style={styles.leaderboardPoints}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.leaderboardPointsText}>{entry.totalPoints}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // 积分统计卡片
  statsCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },

  // 每日挑战
  dailyCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    backgroundColor: '#FFF8E1',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  dailyCardCompleted: {
    backgroundColor: '#F5F5F5',
    borderColor: Colors.border,
  },
  dailyContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dailyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dailyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF3CD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dailyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  dailySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dailyRight: {},
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  startButtonText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  completedText: {
    color: Colors.success,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  dailyReward: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  dailyRewardText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  // 分类卡片
  sectionHeader: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.xl - Spacing.xs,
    gap: Spacing.md,
  },
  categoryCard: {
    width: (width - Spacing.xl * 2 - Spacing.md) / 2,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.md,
  },
  categoryIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  categoryName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // 排行榜
  leaderboardCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
    overflow: 'hidden',
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  leaderboardItemBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  leaderboardRank: {
    width: 32,
    alignItems: 'center',
  },
  medalBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  medalText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  rankText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  leaderboardAvatar: {
    marginHorizontal: Spacing.md,
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  leaderboardMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  leaderboardPoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leaderboardPointsText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.secondary,
  },

  bottomPadding: {
    height: Spacing.xxxl,
  },
});
