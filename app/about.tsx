import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { safeBack } from '../src/utils/nav';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../src/utils/theme';

const features = [
  { icon: 'book' as const, title: '品种百科', desc: '涵盖猫咪、狗狗等数十种宠物品种的详细资料' },
  { icon: 'sparkles' as const, title: 'AI 顾问', desc: '智能宠物健康与养护问答，随时解答疑惑' },
  { icon: 'paw' as const, title: '虚拟宠物', desc: '领养专属虚拟宠物，体验养宠乐趣' },
  { icon: 'people' as const, title: '宠友社区', desc: '分享养宠日常，交流养宠经验' },
  { icon: 'trophy' as const, title: '积分体系', desc: '签到、答题、互动赚积分，兑换好礼' },
  { icon: 'school' as const, title: '知识答题', desc: '趣味答题增长宠物知识' },
];

const team = [
  { name: '产品设计', desc: '用户体验与交互设计' },
  { name: '前端开发', desc: 'React Native / Expo 跨平台开发' },
  { name: '后端开发', desc: 'Node.js / Express 服务端开发' },
  { name: '内容运营', desc: '品种资料整理与内容审核' },
];

export default function AboutPage() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>关于我们</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* App Logo & Name */}
        <View style={styles.heroSection}>
          <LinearGradient colors={[Colors.primary + '30', Colors.primary + '05']} style={styles.heroGradient}>
            <View style={styles.logoCircle}>
              <Ionicons name="paw" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.appName}>萌宠星球</Text>
            <Text style={styles.appSlogan}>你的宠物百科与养宠助手</Text>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>v1.0.0</Text>
            </View>
          </LinearGradient>
        </View>

        {/* 关于我们 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>关于萌宠星球</Text>
          <View style={styles.card}>
            <Text style={styles.bodyText}>
              萌宠星球是一款集宠物品种百科、AI智能顾问、虚拟宠物养成和宠友社区于一体的综合性宠物应用。
            </Text>
            <Text style={styles.bodyText}>
              我们致力于为宠物爱好者提供全面、专业的宠物知识，帮助每一位铲屎官更好地了解和照顾自己的毛孩子。无论你是资深养宠达人还是新手小白，都能在这里找到有用的信息和志同道合的朋友。
            </Text>
          </View>
        </View>

        {/* 核心功能 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>核心功能</Text>
          <View style={styles.featuresGrid}>
            {features.map((f, i) => (
              <View key={i} style={styles.featureCard}>
                <View style={[styles.featureIcon, { backgroundColor: Colors.primary + '15' }]}>
                  <Ionicons name={f.icon} size={24} color={Colors.primary} />
                </View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 团队 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>团队介绍</Text>
          <View style={styles.card}>
            {team.map((t, i) => (
              <View key={i} style={[styles.teamItem, i < team.length - 1 && styles.teamItemBorder]}>
                <View style={styles.teamDot} />
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>{t.name}</Text>
                  <Text style={styles.teamDesc}>{t.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 联系我们 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>联系我们</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.contactItem}
              activeOpacity={0.7}
              onPress={() => Linking.openURL('mailto:feedback@petplanet.com').catch(() => Alert.alert('提示', '无法打开邮件客户端'))}
            >
              <Ionicons name="mail-outline" size={20} color={Colors.primary} />
              <Text style={styles.contactText}>feedback@petplanet.com</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contactItem}
              activeOpacity={0.7}
              onPress={() => Alert.alert('客服热线', '400-888-PETS (7387)')}
            >
              <Ionicons name="call-outline" size={20} color={Colors.primary} />
              <Text style={styles.contactText}>400-888-PETS (7387)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contactItem}
              activeOpacity={0.7}
              onPress={() => Alert.alert('微信公众号', '搜索「萌宠星球」关注我们的公众号')}
            >
              <Ionicons name="logo-wechat" size={20} color="#07C160" />
              <Text style={styles.contactText}>微信公众号：萌宠星球</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 法律信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>法律信息</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.legalItem} activeOpacity={0.7} onPress={() => Alert.alert('用户协议', '用户协议内容即将完善')}>
              <Text style={styles.legalText}>用户协议</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.legalItem} activeOpacity={0.7} onPress={() => Alert.alert('隐私政策', '隐私政策内容即将完善')}>
              <Text style={styles.legalText}>隐私政策</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.legalItem} activeOpacity={0.7} onPress={() => Alert.alert('开源许可', '开源许可信息即将完善')}>
              <Text style={styles.legalText}>开源许可</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.copyright}>© 2026 萌宠星球 Pet Planet. All rights reserved.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  content: { flex: 1 },
  contentContainer: { paddingBottom: 100 },
  // Hero
  heroSection: { marginHorizontal: Spacing.xl, marginTop: Spacing.xl, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.lg },
  heroGradient: { alignItems: 'center', paddingVertical: Spacing.xxxl, paddingHorizontal: Spacing.xl },
  logoCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  appName: { fontSize: 28, fontWeight: '800', color: Colors.text, marginBottom: Spacing.xs },
  appSlogan: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.lg },
  versionBadge: { backgroundColor: Colors.primary + '20', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, borderRadius: BorderRadius.xl },
  versionText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary },
  // Sections
  section: { marginTop: Spacing.xl, paddingHorizontal: Spacing.xl },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, ...Shadows.sm },
  bodyText: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 24, marginBottom: Spacing.md },
  // Features
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  featureCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  featureIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  featureTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  featureDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  // Team
  teamItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md },
  teamItemBorder: { borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  teamDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginRight: Spacing.md },
  teamInfo: { flex: 1 },
  teamName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  teamDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  // Contact
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  contactText: { fontSize: FontSize.md, color: Colors.text },
  // Legal
  legalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  legalText: { fontSize: FontSize.md, color: Colors.text },
  copyright: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.textLight, marginTop: Spacing.xxl, marginBottom: Spacing.lg },
});
