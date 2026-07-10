import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  Vibration,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../../src/utils/nav';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';
import { useAuth } from '../../src/contexts/AuthContext';
import type { QuizCategory, QuizQuestion, QuizDifficulty } from '../../src/types';
import {
  getDailyChallengeQuestions,
  getQuestionsByCategory,
  saveQuizRecord,
} from '../../src/services/quizService';
import {
  categoryNames,
  difficultyNames,
  difficultyColors,
} from '../../src/data/quizzes';
import { pointsService } from '../../src/services/pointsService';

const { width } = Dimensions.get('window');
const TIMER_DURATION = 30;

export default function QuizPlayScreen() {
  const { mode, category } = useLocalSearchParams<{
    mode: 'daily' | 'category';
    category?: QuizCategory;
  }>();
  const { user } = useAuth();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [isFinished, setIsFinished] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);

  // 动画值
  const progressAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 初始化题目
  useEffect(() => {
    let qs: QuizQuestion[] = [];
    if (mode === 'daily') {
      qs = getDailyChallengeQuestions();
    } else if (category) {
      qs = getQuestionsByCategory(category);
    }
    setQuestions(qs);
    setAnswers(new Array(qs.length).fill(null));
    setStartTime(Date.now());
  }, [mode, category]);

  // 计时器
  useEffect(() => {
    if (isFinished || isAnswered || questions.length === 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // 时间到，自动跳到下一题
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentIndex, isAnswered, isFinished, questions.length]);

  // 更新进度条动画
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: timeLeft / TIMER_DURATION,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [timeLeft]);

  // 题目切换动画
  useEffect(() => {
    slideAnim.setValue(300);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentIndex]);

  const handleTimeUp = useCallback(() => {
    if (isAnswered) return;
    setIsAnswered(true);
    setSelectedAnswer(-1); // -1 表示超时未答

    const newAnswers = [...answers];
    newAnswers[currentIndex] = -1;
    setAnswers(newAnswers);

    if (Platform.OS !== 'web') {
      Vibration.vibrate(200);
    }

    setTimeout(() => {
      goToNext();
    }, 2000);
  }, [currentIndex, isAnswered, answers]);

  const handleAnswer = (index: number) => {
    if (isAnswered) return;

    setSelectedAnswer(index);
    setIsAnswered(true);

    const newAnswers = [...answers];
    newAnswers[currentIndex] = index;
    setAnswers(newAnswers);

    const currentQuestion = questions[currentIndex];
    const isCorrect = index === currentQuestion.answer;

    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
      setTotalPoints((prev) => prev + currentQuestion.points);

      // 答对动画
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      // 打勾动画
      checkAnim.setValue(0);
      Animated.spring(checkAnim, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }).start();
    } else {
      // 答错震动
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 100, 50, 100]);
      }

      // 错误抖动动画
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }

    setTimeout(() => {
      goToNext();
    }, 2500);
  };

  const goToNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setTimeLeft(TIMER_DURATION);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = () => {
    setIsFinished(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    if (user) {
      saveQuizRecord(
        user.id,
        mode === 'daily' ? 'daily' : (category as QuizCategory),
        correctCount + (selectedAnswer === questions[currentIndex]?.answer ? 1 : 0),
        questions.length,
        totalPoints,
        timeSpent
      ).catch(() => {});
    }

    // Sync quiz points to main points system
    if (totalPoints > 0) {
      const categoryLabel = mode === 'daily' ? '每日挑战' : (categoryNames[category as QuizCategory] || '答题');
      pointsService.addPoints(totalPoints, 'quiz', `${categoryLabel}奖励`).catch(() => {});
    }
  };

  const handleGoBack = () => {
    safeBack();
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setCorrectCount(0);
    setTotalPoints(0);
    setTimeLeft(TIMER_DURATION);
    setIsFinished(false);
    setStartTime(Date.now());

    let qs: QuizQuestion[] = [];
    if (mode === 'daily') {
      qs = getDailyChallengeQuestions();
    } else if (category) {
      qs = getQuestionsByCategory(category);
    }
    setQuestions(qs);
    setAnswers(new Array(qs.length).fill(null));
  };

  // 获取选项样式
  const getOptionStyle = (index: number) => {
    if (!isAnswered) {
      return selectedAnswer === index ? styles.optionSelected : null;
    }

    const currentQuestion = questions[currentIndex];
    if (index === currentQuestion.answer) {
      return styles.optionCorrect;
    }
    if (index === selectedAnswer && index !== currentQuestion.answer) {
      return styles.optionWrong;
    }
    return styles.optionDisabled;
  };

  const getOptionTextStyle = (index: number) => {
    if (!isAnswered) {
      return selectedAnswer === index ? styles.optionTextSelected : null;
    }

    const currentQuestion = questions[currentIndex];
    if (index === currentQuestion.answer) {
      return styles.optionTextCorrect;
    }
    if (index === selectedAnswer && index !== currentQuestion.answer) {
      return styles.optionTextWrong;
    }
    return styles.optionTextDisabled;
  };

  // 完成页面
  if (isFinished) {
    const finalCorrectCount = correctCount;
    const score = Math.round((finalCorrectCount / questions.length) * 100);
    const timeSpent = Math.round((Date.now() - startTime) / 1000);

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.resultContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 成绩卡片 */}
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Ionicons
                name={score >= 80 ? 'trophy' : score >= 60 ? 'ribbon' : 'school'}
                size={48}
                color={score >= 80 ? '#FFD700' : score >= 60 ? Colors.secondary : Colors.textSecondary}
              />
              <Text style={styles.resultTitle}>
                {score >= 80 ? '太棒了！' : score >= 60 ? '不错哦！' : '继续加油！'}
              </Text>
              <Text style={styles.resultSubtitle}>
                {mode === 'daily' ? '每日挑战' : categoryNames[category as QuizCategory]} 完成
              </Text>
            </View>

            {/* 分数圆环 */}
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreValue}>{score}</Text>
              <Text style={styles.scoreUnit}>分</Text>
            </View>

            {/* 统计数据 */}
            <View style={styles.resultStats}>
              <View style={styles.resultStatItem}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                <Text style={styles.resultStatValue}>{finalCorrectCount}</Text>
                <Text style={styles.resultStatLabel}>答对</Text>
              </View>
              <View style={styles.resultStatItem}>
                <Ionicons name="close-circle" size={24} color={Colors.error} />
                <Text style={styles.resultStatValue}>{questions.length - finalCorrectCount}</Text>
                <Text style={styles.resultStatLabel}>答错</Text>
              </View>
              <View style={styles.resultStatItem}>
                <Ionicons name="star" size={24} color="#FFD700" />
                <Text style={styles.resultStatValue}>{totalPoints}</Text>
                <Text style={styles.resultStatLabel}>积分</Text>
              </View>
              <View style={styles.resultStatItem}>
                <Ionicons name="time" size={24} color={Colors.primary} />
                <Text style={styles.resultStatValue}>{timeSpent}秒</Text>
                <Text style={styles.resultStatLabel}>用时</Text>
              </View>
            </View>
          </View>

          {/* 答题详情 */}
          <View style={styles.answerDetails}>
            <Text style={styles.answerDetailsTitle}>答题详情</Text>
            {questions.map((q, index) => (
              <View key={q.id} style={styles.answerDetailItem}>
                <View
                  style={[
                    styles.answerDetailIndex,
                    {
                      backgroundColor:
                        answers[index] === q.answer
                          ? Colors.success + '20'
                          : answers[index] === -1
                          ? Colors.warning + '20'
                          : Colors.error + '20',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.answerDetailIndexText,
                      {
                        color:
                          answers[index] === q.answer
                            ? Colors.success
                            : answers[index] === -1
                            ? Colors.warning
                            : Colors.error,
                      },
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.answerDetailContent}>
                  <Text style={styles.answerDetailQuestion} numberOfLines={1}>
                    {q.question}
                  </Text>
                  <Text style={styles.answerDetailAnswer}>
                    正确答案：{q.options[q.answer]}
                  </Text>
                </View>
                <Ionicons
                  name={
                    answers[index] === q.answer
                      ? 'checkmark-circle'
                      : answers[index] === -1
                      ? 'time'
                      : 'close-circle'
                  }
                  size={20}
                  color={
                    answers[index] === q.answer
                      ? Colors.success
                      : answers[index] === -1
                      ? Colors.warning
                      : Colors.error
                  }
                />
              </View>
            ))}
          </View>

          {/* 操作按钮 */}
          <View style={styles.resultActions}>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Ionicons name="refresh" size={20} color={Colors.primary} />
              <Text style={styles.retryButtonText}>再试一次</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeButton} onPress={handleGoBack}>
              <Ionicons name="home" size={20} color="#fff" />
              <Text style={styles.homeButtonText}>返回</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 加载中
  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载题目中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {mode === 'daily' ? '每日挑战' : categoryNames[category as QuizCategory]}
          </Text>
          <Text style={styles.headerSubtitle}>
            {currentIndex + 1} / {questions.length}
          </Text>
        </View>
        <View style={styles.timerContainer}>
          <Ionicons
            name="time"
            size={16}
            color={timeLeft <= 10 ? Colors.error : Colors.primary}
          />
          <Text
            style={[
              styles.timerText,
              { color: timeLeft <= 10 ? Colors.error : Colors.text },
            ]}
          >
            {timeLeft}s
          </Text>
        </View>
      </View>

      {/* 进度条 */}
      <View style={styles.progressBarContainer}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: timeLeft <= 10 ? Colors.error : Colors.primary,
            },
          ]}
        />
      </View>

      {/* 题目内容 */}
      <Animated.View
        style={[
          styles.questionContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        <ScrollView
          style={styles.questionScroll}
          contentContainerStyle={styles.questionScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 难度标签 */}
          <View style={styles.difficultyBadge}>
            <View
              style={[
                styles.difficultyDot,
                { backgroundColor: difficultyColors[currentQuestion.difficulty] },
              ]}
            />
            <Text style={styles.difficultyText}>
              {difficultyNames[currentQuestion.difficulty]}
            </Text>
            <Text style={styles.pointsText}>+{currentQuestion.points}积分</Text>
          </View>

          {/* 题目 */}
          <Text style={styles.questionText}>{currentQuestion.question}</Text>

          {/* 选项 */}
          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.option, getOptionStyle(index)]}
                onPress={() => handleAnswer(index)}
                activeOpacity={isAnswered ? 1 : 0.7}
                disabled={isAnswered}
              >
                <View style={[styles.optionIndex, getOptionStyle(index)]}>
                  <Text
                    style={[
                      styles.optionIndexText,
                      getOptionTextStyle(index),
                    ]}
                  >
                    {String.fromCharCode(65 + index)}
                  </Text>
                </View>
                <Text style={[styles.optionText, getOptionTextStyle(index)]}>
                  {option}
                </Text>
                {isAnswered && index === currentQuestion.answer && (
                  <Animated.View
                    style={{
                      transform: [{ scale: checkAnim }],
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                  </Animated.View>
                )}
                {isAnswered &&
                  index === selectedAnswer &&
                  index !== currentQuestion.answer && (
                    <Ionicons name="close-circle" size={24} color={Colors.error} />
                  )}
              </TouchableOpacity>
            ))}
          </View>

          {/* 解析 */}
          {isAnswered && (
            <Animated.View
              style={[
                styles.explanationContainer,
                { opacity: fadeAnim },
              ]}
            >
              <View style={styles.explanationHeader}>
                <Ionicons
                  name={
                    selectedAnswer === currentQuestion.answer
                      ? 'checkmark-circle'
                      : 'information-circle'
                  }
                  size={20}
                  color={
                    selectedAnswer === currentQuestion.answer
                      ? Colors.success
                      : Colors.warning
                  }
                />
                <Text style={styles.explanationTitle}>
                  {selectedAnswer === currentQuestion.answer ? '回答正确！' : '答案解析'}
                </Text>
              </View>
              <Text style={styles.explanationText}>
                {currentQuestion.explanation}
              </Text>
            </Animated.View>
          )}
        </ScrollView>
      </Animated.View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
  },

  // 头部
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  timerText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },

  // 进度条
  progressBarContainer: {
    height: 4,
    backgroundColor: Colors.border,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },

  // 题目容器
  questionContainer: {
    flex: 1,
  },
  questionScroll: {
    flex: 1,
  },
  questionScrollContent: {
    padding: Spacing.xl,
  },

  // 难度标签
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  difficultyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  difficultyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginRight: Spacing.sm,
  },
  pointsText: {
    fontSize: FontSize.sm,
    color: Colors.secondary,
    fontWeight: '600',
  },

  // 题目文本
  questionText: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 32,
    marginBottom: Spacing.xxl,
  },

  // 选项
  optionsContainer: {
    gap: Spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadows.sm,
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '08',
  },
  optionCorrect: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '10',
  },
  optionWrong: {
    borderColor: Colors.error,
    backgroundColor: Colors.error + '10',
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  optionIndexText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  optionText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 24,
  },
  optionTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  optionTextCorrect: {
    color: Colors.success,
    fontWeight: '600',
  },
  optionTextWrong: {
    color: Colors.error,
    fontWeight: '600',
  },
  optionTextDisabled: {
    color: Colors.textLight,
  },

  // 解析
  explanationContainer: {
    marginTop: Spacing.xxl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  explanationTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  explanationText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 24,
  },

  // 结果页面
  resultContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    alignItems: 'center',
    ...Shadows.lg,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  resultTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.md,
  },
  resultSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.primary,
  },
  scoreUnit: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: -4,
  },
  resultStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  resultStatItem: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  resultStatValue: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  resultStatLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  // 答题详情
  answerDetails: {
    marginTop: Spacing.xxl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  answerDetailsTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  answerDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  answerDetailIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  answerDetailIndexText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  answerDetailContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  answerDetailQuestion: {
    fontSize: FontSize.md,
    color: Colors.text,
    marginBottom: 2,
  },
  answerDetailAnswer: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  // 操作按钮
  resultActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xxl,
  },
  retryButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  retryButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  homeButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
  },
  homeButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
});
