import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { Colors, Spacing, BorderRadius, FontSize } from '../../src/utils/theme';
import { aiService } from '../../src/services/aiService';
import { useVoiceRecorder } from '../../src/hooks/useVoiceTools';
import type { QuickAction } from '../../src/types';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  safetyNote?: string;
}

const quickActions: QuickAction[] = [
  { icon: 'camera', label: '拍照识别', desc: '拍一张宠物照片', color: Colors.primary, bg: Colors.primary },
  { icon: 'compass', label: '品种推荐', desc: '为你量身推荐', color: Colors.secondary, bg: Colors.secondary },
  { icon: 'medkit', label: '健康问答', desc: '专业养护建议', color: Colors.accent, bg: Colors.accent },
  { icon: 'sparkles', label: '冷知识', desc: '趣味品种故事', color: '#9B5DE5', bg: '#9B5DE5' },
];

const presetQuestions = [
  '布偶猫好养吗？',
  '适合公寓的狗有哪些？',
  '新手养猫推荐什么品种？',
  '金毛和拉布拉多哪个好？',
  '猫咪不吃东西怎么办？',
  '狗狗疫苗接种时间表？',
  '如何训练猫咪用猫砂？',
  '什么狗最适合陪伴小孩？',
];

const aiResponses: Record<string, string> = {
  '布偶猫好养吗？': '布偶猫总体来说是比较适合新手饲养的猫咪品种！\n\n优点：\n· 性格温顺粘人，非常亲人\n· 不太活跃，适合公寓生活\n· 与小孩和其他宠物相处融洽\n\n需要注意：\n· 长毛需要定期梳理，建议每天梳毛\n· 容易发胖，需要控制饮食\n· 有一定的遗传病风险\n· 价格较高，建议从正规猫舍购买\n\n总的来说，布偶猫是非常棒的家庭伴侣！',
  '适合公寓的狗有哪些？': '适合公寓饲养的狗狗品种推荐：\n\n小型犬：\n· 柯基 - 活泼聪明，体型适中\n· 法斗 - 运动量小，性格温和\n· 比熊 - 不掉毛，性格好\n· 雪纳瑞 - 聪明，不易掉毛\n\n中型犬：\n· 柴犬 - 爱干净，体型紧凑\n\n选择建议：\n1. 优先考虑运动量需求低的品种\n2. 注意叫声大小，避免扰邻\n3. 确保每天有时间遛狗',
  '新手养猫推荐什么品种？': '新手养猫推荐以下品种：\n\n1. 英国短毛猫 - 性格独立安静，好打理\n2. 美国短毛猫 - 性格友善，健康状况良好\n3. 布偶猫 - 非常亲人，性格温顺\n4. 暹罗猫 - 聪明活泼，喜欢与人互动\n\n新手注意事项：\n· 提前准备好猫砂盆、猫粮、猫抓板\n· 选择正规渠道购买或领养\n· 及时带去宠物医院体检和打疫苗',
  '金毛和拉布拉多哪个好？': '金毛和拉布拉多都是非常优秀的家庭犬：\n\n金毛寻回犬：\n· 毛发更长，需要更多梳理\n· 性格更温柔安静\n· 更适合作为陪伴犬\n\n拉布拉多：\n· 短毛更好打理\n· 更活泼好动\n· 更贪吃，容易发胖\n\n选择建议：\n· 安静陪伴选金毛\n· 户外运动选拉布拉多\n· 有小孩两者都适合',
  '猫咪不吃东西怎么办？': '猫咪不吃东西可能有多种原因：\n\n1. 观察症状：精神状态、有无呕吐腹泻\n\n2. 常见原因：\n· 食物不合口味或突然换粮\n· 口腔问题（牙龈炎、口炎）\n· 肠胃不适或毛球症\n· 压力或环境变化\n\n3. 应对方法：\n· 尝试加热食物增加香味\n· 少食多餐\n· 喂食化毛膏\n\n4. 超过24小时不吃请尽快就医！',
  '狗狗疫苗接种时间表？': '狗狗疫苗接种时间表：\n\n幼犬首次免疫（3针）：\n· 42天龄：第一针（二联）\n· 70天龄：第二针（四联）\n· 98天龄：第三针 + 狂犬疫苗\n\n成年犬每年加强：\n· 每年一针联苗 + 一针狂犬\n\n注意事项：\n· 接种前确保狗狗健康\n· 接种后一周内不要洗澡\n· 选择正规宠物医院',
  '如何训练猫咪用猫砂？': '训练猫咪使用猫砂盆的方法：\n\n准备工作：\n· 选择合适的猫砂盆\n· 建议先用膨润土猫砂\n· 放置在安静通风的位置\n\n训练步骤：\n1. 饭后或睡醒后放到猫砂盆里\n2. 用爪子轻轻拨动猫砂\n3. 成功使用给予零食奖励\n4. 重复引导，一般3-7天学会\n\n小贴士：大多数猫咪天生就会用猫砂！',
  '什么狗最适合陪伴小孩？': '最适合陪伴小孩的狗狗品种：\n\n1. 金毛寻回犬 - 温柔耐心，对小孩友善\n2. 拉布拉多 - 活泼友好，忍耐力强\n3. 比格犬 - 体型适中，性格开朗\n4. 贵宾犬 - 不掉毛，聪明易训练\n5. 柯基 - 活泼可爱，体型适中\n\n安全提示：\n· 教导孩子正确与狗相处\n· 监督孩子与狗的互动\n· 定期带狗体检和打疫苗',
};

const defaultResponse = '感谢你的提问！作为 AI 宠物顾问，我建议你可以：\n\n1. 查看宠物百科了解详细信息\n2. 咨询专业兽医获取建议\n3. 在社区与其他宠物主人交流\n\n有更具体的问题随时问我！';

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: '你好！我是萌宠星球的 AI 宠物顾问。\n\n我可以帮你：\n· 识别宠物品种\n· 推荐适合你的宠物\n· 解答养护问题\n· 分享品种冷知识\n\n有什么想问的吗？',
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const typingDot1 = useRef(new Animated.Value(0)).current;
  const typingDot2 = useRef(new Animated.Value(0)).current;
  const typingDot3 = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const { isRecording, lastRecordingUri, startRecording, stopRecording } = useVoiceRecorder();
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' }).start();
  }, []);

  const startTypingAnimation = useCallback(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      );
    const a1 = anim(typingDot1, 0);
    const a2 = anim(typingDot2, 200);
    const a3 = anim(typingDot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [typingDot1, typingDot2, typingDot3]);

  const simulateAIResponse = useCallback(async (userMessage: string) => {
    setIsTyping(true);
    const stop = startTypingAnimation();

    try {
      // Build conversation history for context (last 10 messages)
      const history = messages.slice(-10).map((m) => ({ text: m.text, isUser: m.isUser }));
      history.push({ text: userMessage, isUser: true });

      const aiResult = await aiService.chat(history);

      stop();
      typingDot1.setValue(0); typingDot2.setValue(0); typingDot3.setValue(0);
      setIsTyping(false);
      setMessages((p) => [...p, {
        id: Date.now().toString(),
        text: aiResult.reply,
        safetyNote: aiResult.safetyNote,
        isUser: false,
        timestamp: new Date(),
      }]);
    } catch (err) {
      console.log('[AI] API 调用失败，降级到本地回复:', err);
      // Fallback to local mock responses
      const text = aiResponses[userMessage] || defaultResponse;
      stop();
      typingDot1.setValue(0); typingDot2.setValue(0); typingDot3.setValue(0);
      setIsTyping(false);
      setMessages((p) => [...p, { id: Date.now().toString(), text, isUser: false, timestamp: new Date() }]);
    }
  }, [startTypingAnimation, typingDot1, typingDot2, typingDot3, messages]);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    const msg = inputText.trim();
    setMessages((p) => [...p, { id: Date.now().toString(), text: msg, isUser: true, timestamp: new Date() }]);
    setInputText('');
    simulateAIResponse(msg);
  }, [inputText, simulateAIResponse]);

  const handleVoiceInput = useCallback(async () => {
    try {
      if (isRecording) {
        const uri = await stopRecording();
        const voicePrompt = uri
          ? `我刚录了一段语音咨询，请根据宠物养护场景给我建议。录音文件：${uri}`
          : '我刚录了一段语音咨询，请根据宠物养护场景给我建议。';
        setMessages((p) => [...p, { id: Date.now().toString(), text: '已发送一段语音咨询', isUser: true, timestamp: new Date() }]);
        simulateAIResponse(voicePrompt);
        return;
      }
      await startRecording();
    } catch (error) {
      Alert.alert('语音不可用', error instanceof Error ? error.message : '无法启动语音功能，请稍后再试');
    }
  }, [isRecording, simulateAIResponse, startRecording, stopRecording]);

  const speakMessage = useCallback(async (message: Message) => {
    if (message.isUser) return;
    try {
      const speaking = await Speech.isSpeakingAsync();
      if (speaking && speakingMessageId === message.id) {
        await Speech.stop();
        setSpeakingMessageId(null);
        return;
      }
      if (speaking) await Speech.stop();
      setSpeakingMessageId(message.id);
      Speech.speak(message.text.slice(0, Speech.maxSpeechInputLength), {
        language: 'zh-CN',
        rate: 0.92,
        pitch: 1,
        onDone: () => setSpeakingMessageId(null),
        onStopped: () => setSpeakingMessageId(null),
        onError: () => setSpeakingMessageId(null),
      });
    } catch {
      Alert.alert('朗读失败', '当前设备暂时无法朗读这条回复');
      setSpeakingMessageId(null);
    }
  }, [speakingMessageId]);

  const handlePresetQuestion = useCallback((q: string) => {
    setMessages((p) => [...p, { id: Date.now().toString(), text: q, isUser: true, timestamp: new Date() }]);
    setShowPresets(false);
    simulateAIResponse(q);
  }, [simulateAIResponse]);

  const handleQuickAction = useCallback((label: string) => {
    const map: Record<string, string> = {
      '拍照识别': '我想识别一下宠物品种', '品种推荐': '推荐适合我的宠物品种',
      '健康问答': '宠物健康问题咨询', '冷知识': '分享一些宠物冷知识',
    };
    handlePresetQuestion(map[label] || label);
  }, [handlePresetQuestion]);

  const formatTime = (d: Date) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>AI 顾问</Text>
          <Text style={styles.subtitle}>你的智能宠物助手</Text>
        </View>
        <TouchableOpacity style={styles.historyBtn} onPress={() => setShowPresets(true)}>
          <Ionicons name="help-circle-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={styles.chatContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <ScrollView ref={scrollViewRef} contentContainerStyle={styles.chatContent} showsVerticalScrollIndicator={false} onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
          <Animated.View style={[styles.quickGrid, { opacity: fadeAnim }]}>
            {quickActions.map((action, index) => (
              <TouchableOpacity key={index} style={styles.quickCard} activeOpacity={0.8} onPress={() => handleQuickAction(action.label)}>
                <LinearGradient colors={[action.bg + '15', action.bg + '05']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickIconWrap}>
                  <Ionicons name={action.icon as any} size={22} color={action.color} />
                </LinearGradient>
                <Text style={styles.quickLabel}>{action.label}</Text>
                <Text style={styles.quickDesc}>{action.desc}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
          <View style={styles.safetyNotice}>
            <Ionicons name="shield-checkmark-outline" size={16} color={Colors.accent} />
            <Text style={styles.safetyNoticeText}>
              健康、用药和急症问题请以执业兽医诊断为准，AI 建议仅供养宠参考。
            </Text>
          </View>

          <View style={styles.messagesContainer}>
            {messages.map((message) => (
              <View key={message.id} style={[styles.messageWrap, message.isUser ? styles.userMessageWrap : styles.aiMessageWrapContainer]}>
                {!message.isUser && (
                  <View style={styles.aiAvatarWrap}>
                    <LinearGradient colors={[Colors.primary + '20', Colors.primaryLight + '10']} style={styles.aiAvatar}>
                      <Ionicons name="sparkles" size={16} color={Colors.primary} />
                    </LinearGradient>
                  </View>
                )}
                <View style={[styles.messageBubble, message.isUser ? styles.userBubble : styles.aiBubble]}>
                  {!message.isUser && (
                    <View style={styles.aiBubbleHeader}>
                      <Text style={styles.aiName}>萌宠顾问</Text>
                      <View style={styles.onlineDot} />
                    </View>
                  )}
                  <Text style={[styles.messageText, message.isUser && styles.userMessageText]}>{message.text}</Text>
                  {!message.isUser && message.safetyNote && (
                    <View style={styles.messageSafetyNote}>
                      <Ionicons name="alert-circle-outline" size={14} color={Colors.accent} />
                      <Text style={styles.messageSafetyNoteText}>{message.safetyNote}</Text>
                    </View>
                  )}
                  <View style={styles.messageFooter}>
                    <Text style={[styles.messageTime, message.isUser && styles.userMessageTime]}>{formatTime(message.timestamp)}</Text>
                    {!message.isUser && (
                      <TouchableOpacity style={styles.speakBtn} onPress={() => speakMessage(message)} activeOpacity={0.7}>
                        <Ionicons
                          name={speakingMessageId === message.id ? 'volume-high' : 'volume-medium-outline'}
                          size={14}
                          color={speakingMessageId === message.id ? Colors.primary : Colors.textLight}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))}

            {isTyping && (
              <View style={styles.typingWrap}>
                <View style={styles.aiAvatarWrap}>
                  <LinearGradient colors={[Colors.primary + '20', Colors.primaryLight + '10']} style={styles.aiAvatar}>
                    <Ionicons name="sparkles" size={16} color={Colors.primary} />
                  </LinearGradient>
                </View>
                <View style={styles.typingBubble}>
                  <View style={styles.typingDots}>
                    <Animated.View style={[styles.typingDot, { opacity: typingDot1 }]} />
                    <Animated.View style={[styles.typingDot, { opacity: typingDot2 }]} />
                    <Animated.View style={[styles.typingDot, { opacity: typingDot3 }]} />
                  </View>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.inputArea}>
          <TouchableOpacity style={styles.presetBtn} onPress={() => setShowPresets(true)} activeOpacity={0.7}>
            <Ionicons name="list" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.voiceInputBtn, isRecording && styles.voiceInputBtnActive]}
            onPress={handleVoiceInput}
            activeOpacity={0.75}
          >
            <Ionicons name={isRecording ? 'stop' : 'mic'} size={18} color={isRecording ? Colors.surface : Colors.secondary} />
          </TouchableOpacity>
          <TextInput style={styles.textInput} value={inputText} onChangeText={setInputText} placeholder="请输入你的问题..." placeholderTextColor={Colors.textLight} multiline maxLength={500} />
          <TouchableOpacity style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]} onPress={handleSend} activeOpacity={0.8} disabled={!inputText.trim() || isTyping}>
            <LinearGradient colors={inputText.trim() && !isTyping ? [Colors.primary, Colors.primaryDark] : [Colors.border, Colors.border]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendBtnGradient}>
              <Ionicons name="send" size={16} color={inputText.trim() && !isTyping ? Colors.surface : Colors.textLight} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
        {lastRecordingUri && (
          <View style={styles.voiceHint}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
            <Text style={styles.voiceHintText}>语音已记录，可继续提问或再次录音</Text>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal visible={showPresets} animationType="slide" transparent onRequestClose={() => setShowPresets(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>快捷提问</Text>
              <TouchableOpacity onPress={() => setShowPresets(false)}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.presetList}>
              {presetQuestions.map((q, i) => (
                <TouchableOpacity key={i} style={styles.presetItem} onPress={() => handlePresetQuestion(q)} activeOpacity={0.7}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.primary} />
                  <Text style={styles.presetText}>{q}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  headerLeft: { flex: 1 },
  title: { fontSize: FontSize.title, fontWeight: '800', color: Colors.text, letterSpacing: 0.5 },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  historyBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  chatContainer: { flex: 1 },
  chatContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.lg },
  quickCard: { width: '47%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, shadowColor: '#1D3557', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  quickIconWrap: { width: 44, height: 44, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  quickLabel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  quickDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  safetyNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.accent + '10', borderWidth: 1, borderColor: Colors.accent + '22' },
  safetyNoticeText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  messagesContainer: { marginTop: Spacing.xxl },
  messageWrap: { marginBottom: Spacing.lg },
  userMessageWrap: { alignItems: 'flex-end' },
  aiMessageWrapContainer: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  aiAvatarWrap: { width: 36, height: 36 },
  aiAvatar: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  messageBubble: { maxWidth: '80%', borderRadius: BorderRadius.lg, padding: Spacing.lg, shadowColor: '#1D3557', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  userBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: Colors.surface, borderBottomLeftRadius: 4 },
  aiBubbleHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  aiName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  messageText: { fontSize: FontSize.md, color: Colors.text, lineHeight: 24 },
  userMessageText: { color: Colors.surface },
  messageSafetyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 0.5, borderTopColor: Colors.border },
  messageSafetyNoteText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  messageFooter: { marginTop: Spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.sm },
  messageTime: { fontSize: FontSize.xs, color: Colors.textLight },
  userMessageTime: { color: Colors.surface + 'CC' },
  speakBtn: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  typingWrap: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', marginBottom: Spacing.lg },
  typingBubble: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderBottomLeftRadius: 4, padding: Spacing.lg, shadowColor: '#1D3557', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  typingDots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  inputArea: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderTopWidth: 0.5, borderTopColor: Colors.border, gap: Spacing.sm },
  presetBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary + '10', justifyContent: 'center', alignItems: 'center' },
  voiceInputBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.secondary + '12', justifyContent: 'center', alignItems: 'center' },
  voiceInputBtnActive: { backgroundColor: Colors.secondary },
  textInput: { flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: Colors.background, borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, fontSize: FontSize.md, color: Colors.text },
  sendBtn: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden' },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnGradient: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.xl, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  presetList: { padding: Spacing.lg },
  presetItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, backgroundColor: Colors.background, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  presetText: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  voiceHint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm, backgroundColor: Colors.surface },
  voiceHintText: { fontSize: FontSize.xs, color: Colors.textSecondary },
});
