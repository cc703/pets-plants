import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../utils/theme';

interface ComingSoonModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
}

export default function ComingSoonModal({
  visible,
  title = '功能开发中',
  message = '这个功能正在开发中，敬请期待。',
  onClose,
}: ComingSoonModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity testID="coming-soon-close-btn" onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.button} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.buttonText}>知道了</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    paddingRight: Spacing.md,
  },
  closeText: {
    fontSize: 28,
    lineHeight: 28,
    color: Colors.textSecondary,
  },
  message: {
    fontSize: FontSize.md,
    lineHeight: 24,
    color: Colors.textSecondary,
  },
  button: {
    marginTop: Spacing.xl,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.surface,
  },
});
