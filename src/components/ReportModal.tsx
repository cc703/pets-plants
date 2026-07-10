/**
 * 举报弹窗组件
 * 选择举报原因并提交
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '../utils/theme';
import { getReportReasons, submitReport } from '../services/moderationService';

interface ReportModalProps {
  visible: boolean;
  targetType: 'post' | 'comment' | 'user';
  targetId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ReportModal({ visible, targetType, targetId, onClose, onSuccess }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reasons = getReportReasons();

  const handleSubmit = useCallback(async () => {
    if (!selectedReason || submitting) return;
    setSubmitting(true);
    try {
      await submitReport({ targetType, targetId, reason: selectedReason, detail: detail.trim() || undefined });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setSelectedReason('');
        setDetail('');
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Failed to submit report:', error);
    } finally {
      setSubmitting(false);
    }
  }, [selectedReason, detail, targetType, targetId, submitting, onSuccess, onClose]);

  const handleClose = useCallback(() => {
    setSelectedReason('');
    setDetail('');
    setSubmitted(false);
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          {submitted ? (
            <View style={styles.successState}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
              </View>
              <Text style={styles.successText}>举报已提交</Text>
              <Text style={styles.successHint}>我们会尽快审核处理</Text>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>举报内容</Text>
                <TouchableOpacity onPress={handleClose}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.reasonList}>
                {reasons.map((reason) => (
                  <TouchableOpacity
                    key={reason.value}
                    style={[styles.reasonItem, selectedReason === reason.value && styles.reasonItemActive]}
                    onPress={() => setSelectedReason(reason.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.radio, selectedReason === reason.value && styles.radioActive]}>
                      {selectedReason === reason.value && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.reasonText, selectedReason === reason.value && styles.reasonTextActive]}>
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.detailInput}
                value={detail}
                onChangeText={setDetail}
                placeholder="补充说明（选填）"
                placeholderTextColor={Colors.textLight}
                multiline
                maxLength={200}
              />

              <TouchableOpacity
                style={[styles.submitBtn, !selectedReason && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={!selectedReason || submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.surface} size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>提交举报</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  content: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  reasonList: { marginBottom: Spacing.lg },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  reasonItemActive: {},
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  reasonText: { fontSize: FontSize.md, color: Colors.text },
  reasonTextActive: { color: Colors.primary, fontWeight: '600' },
  detailInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: Spacing.xl,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.surface },
  successState: { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.md },
  successIcon: { marginBottom: Spacing.sm },
  successText: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  successHint: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
