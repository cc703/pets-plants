/**
 * 评论/回复输入框组件
 * 支持 placeholder 动态变化
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '../../utils/theme';

interface ReplyInputProps {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  autoFocus?: boolean;
}

export default function ReplyInput({
  placeholder = '写下你的评论...',
  value,
  onChangeText,
  onSubmit,
  autoFocus = false,
}: ReplyInputProps) {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (autoFocus) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSubmit();
    Keyboard.dismiss();
  };

  return (
    <View style={styles.container}>
      <TextInput
        testID="reply-input-field"
        ref={inputRef}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textLight}
        maxLength={500}
        multiline={false}
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
      />
      <TouchableOpacity
        testID="reply-input-send"
        style={[styles.sendBtn, !value.trim() && { opacity: 0.4 }]}
        onPress={handleSubmit}
        disabled={!value.trim()}
        activeOpacity={0.7}
      >
        <Ionicons
          name="send"
          size={18}
          color={value.trim() ? Colors.primary : Colors.textLight}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
