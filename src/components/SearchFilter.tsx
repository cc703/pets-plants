import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../utils/theme';
import {
  SIZE_OPTIONS,
  COAT_LENGTH_OPTIONS,
  SPECIES_OPTIONS,
  getSuitableForOptions,
  type SearchFilters,
} from '../services/searchService';
import type { Species } from '../types';

interface SearchFilterProps {
  /** 是否可见 */
  visible: boolean;
  /** 当前筛选条件 */
  filters: SearchFilters;
  /** 确认筛选 */
  onConfirm: (filters: SearchFilters) => void;
  /** 重置筛选 */
  onReset: () => void;
  /** 关闭面板 */
  onClose: () => void;
}

/** 多选标签组 */
function TagGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={tagStyles.section}>
      <Text style={tagStyles.sectionTitle}>{title}</Text>
      <View style={tagStyles.tagsWrap}>
        {options.map(option => {
          const isActive = selected.includes(option);
          return (
            <TouchableOpacity
              key={option}
              style={[tagStyles.tag, isActive && tagStyles.tagActive]}
              onPress={() => onToggle(option)}
              activeOpacity={0.7}
            >
              {isActive && (
                <Ionicons
                  name="checkmark"
                  size={14}
                  color={Colors.primary}
                  style={tagStyles.tagIcon}
                />
              )}
              <Text
                style={[tagStyles.tagText, isActive && tagStyles.tagTextActive]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/** 筛选面板主组件 */
export default function SearchFilter({
  visible,
  filters,
  onConfirm,
  onReset,
  onClose,
}: SearchFilterProps) {
  // 本地状态，用于编辑中的筛选条件
  const [localSpecies, setLocalSpecies] = useState<Species | 'all'>(
    filters.species || 'all'
  );
  const [localSizes, setLocalSizes] = useState<string[]>(filters.sizes || []);
  const [localCoatLengths, setLocalCoatLengths] = useState<string[]>(
    filters.coatLengths || []
  );
  const [localSuitableFor, setLocalSuitableFor] = useState<string[]>(
    filters.suitableFor || []
  );

  const suitableForOptions = useMemo(() => getSuitableForOptions(), []);

  // 每次打开时同步外部 filters
  React.useEffect(() => {
    if (visible) {
      setLocalSpecies(filters.species || 'all');
      setLocalSizes(filters.sizes || []);
      setLocalCoatLengths(filters.coatLengths || []);
      setLocalSuitableFor(filters.suitableFor || []);
    }
  }, [visible, filters]);

  const toggleSize = useCallback((value: string) => {
    setLocalSizes(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  }, []);

  const toggleCoatLength = useCallback((value: string) => {
    setLocalCoatLengths(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  }, []);

  const toggleSuitableFor = useCallback((value: string) => {
    setLocalSuitableFor(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  }, []);

  const handleReset = useCallback(() => {
    setLocalSpecies('all');
    setLocalSizes([]);
    setLocalCoatLengths([]);
    setLocalSuitableFor([]);
    onReset();
  }, [onReset]);

  const handleConfirm = useCallback(() => {
    onConfirm({
      species: localSpecies,
      sizes: localSizes.length > 0 ? localSizes : undefined,
      coatLengths: localCoatLengths.length > 0 ? localCoatLengths : undefined,
      suitableFor: localSuitableFor.length > 0 ? localSuitableFor : undefined,
    });
  }, [localSpecies, localSizes, localCoatLengths, localSuitableFor, onConfirm]);

  const activeCount = useMemo(() => {
    let count = 0;
    if (localSpecies !== 'all') count++;
    count += localSizes.length;
    count += localCoatLengths.length;
    count += localSuitableFor.length;
    return count;
  }, [localSpecies, localSizes, localCoatLengths, localSuitableFor]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.panel} onPress={e => e.stopPropagation()}>
          {/* 拖拽指示条 */}
          <View style={styles.handleBar} />

          {/* 标题栏 */}
          <View style={styles.header}>
            <Text style={styles.title}>
              筛选条件
              {activeCount > 0 && (
                <Text style={styles.activeCount}> ({activeCount})</Text>
              )}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* 物种选择 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>物种</Text>
              <View style={styles.speciesRow}>
                {SPECIES_OPTIONS.map(option => {
                  const isActive = localSpecies === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.speciesBtn,
                        isActive && styles.speciesBtnActive,
                      ]}
                      onPress={() => setLocalSpecies(option.key)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.speciesBtnText,
                          isActive && styles.speciesBtnTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 体型选择 */}
            <TagGroup
              title="体型"
              options={SIZE_OPTIONS}
              selected={localSizes}
              onToggle={toggleSize}
            />

            {/* 毛长选择 */}
            <TagGroup
              title="毛长"
              options={COAT_LENGTH_OPTIONS}
              selected={localCoatLengths}
              onToggle={toggleCoatLength}
            />

            {/* 适合人群 */}
            <TagGroup
              title="适合人群"
              options={suitableForOptions}
              selected={localSuitableFor}
              onToggle={toggleSuitableFor}
            />
          </ScrollView>

          {/* 底部按钮 */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={handleReset}
              activeOpacity={0.7}
            >
              <Text style={styles.resetBtnText}>重置</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={handleConfirm}
              activeOpacity={0.7}
            >
              <Text style={styles.confirmBtnText}>确认筛选</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
    paddingBottom: 34, // safe area
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  activeCount: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.primary,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  speciesRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  speciesBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  speciesBtnActive: {
    backgroundColor: Colors.primary + '12',
    borderColor: Colors.primary,
  },
  speciesBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  speciesBtnTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    marginTop: Spacing.sm,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  resetBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.surface,
  },
});

const tagStyles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tagActive: {
    backgroundColor: Colors.primary + '12',
    borderColor: Colors.primary,
  },
  tagIcon: {
    marginRight: 4,
  },
  tagText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  tagTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
