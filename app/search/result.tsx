import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../../src/utils/nav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';
import BreedCard from '../../src/components/BreedCard';
import AnimatedListItem from '../../src/components/AnimatedListItem';
import SearchFilter from '../../src/components/SearchFilter';
import useSearchHistory from '../../src/hooks/useSearchHistory';
import {
  searchBreeds,
  quickSearch,
  HOT_SEARCHES,
  type SearchFilters,
  type SortBy,
} from '../../src/services/searchService';
import type { Breed } from '../../src/types';

export default function SearchResultPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQuery = params.q || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sortBy, setSortBy] = useState<SortBy>('popularity');
  const [showFilter, setShowFilter] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const { history, addToHistory, clearHistory } = useSearchHistory();
  const searchInputRef = useRef<TextInput>(null);

  // 搜索结果
  const results = useMemo(
    () =>
      searchBreeds({
        query: searchQuery,
        filters,
        sortBy,
      }),
    [searchQuery, filters, sortBy]
  );

  // 搜索建议（实时）
  const suggestions = useMemo(
    () => (searchQuery.trim() && isFocused ? quickSearch(searchQuery, 5) : []),
    [searchQuery, isFocused]
  );

  const handleSubmitSearch = useCallback(() => {
    if (searchQuery.trim()) {
      addToHistory(searchQuery.trim());
    }
    setIsFocused(false);
    searchInputRef.current?.blur();
  }, [searchQuery, addToHistory]);

  const handleSuggestionPress = useCallback(
    (breed: Breed) => {
      setSearchQuery(breed.name);
      addToHistory(breed.name);
      setIsFocused(false);
      searchInputRef.current?.blur();
    },
    [addToHistory]
  );

  const handleHistoryPress = useCallback((query: string) => {
    setSearchQuery(query);
    setIsFocused(false);
    searchInputRef.current?.blur();
  }, []);

  const handleHotSearchPress = useCallback((query: string) => {
    setSearchQuery(query);
    setIsFocused(false);
  }, []);

  const handleFilterConfirm = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
    setShowFilter(false);
  }, []);

  const handleFilterReset = useCallback(() => {
    setFilters({});
  }, []);

  const toggleSort = useCallback(() => {
    setSortBy(prev => (prev === 'popularity' ? 'name' : 'popularity'));
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      (filters.species && filters.species !== 'all') ||
      (filters.sizes && filters.sizes.length > 0) ||
      (filters.coatLengths && filters.coatLengths.length > 0) ||
      (filters.suitableFor && filters.suitableFor.length > 0)
    );
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.species && filters.species !== 'all') count++;
    count += filters.sizes?.length || 0;
    count += filters.coatLengths?.length || 0;
    count += filters.suitableFor?.length || 0;
    return count;
  }, [filters]);

  const renderItem = useCallback(
    ({ item, index }: { item: Breed; index: number }) => (
      <AnimatedListItem index={index} delay={50}>
        <BreedCard breed={item} onPress={() => router.push(`/breed/${item.id}`)} />
      </AnimatedListItem>
    ),
    [router]
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="search-outline" size={40} color={Colors.textLight} />
      </View>
      <Text style={styles.emptyTitle}>没有找到匹配的品种</Text>
      <Text style={styles.emptySubtitle}>试试其他关键词或调整筛选条件</Text>
    </View>
  );

  /** 搜索建议下拉 */
  const renderSuggestions = () => {
    if (!isFocused) return null;

    // 搜索建议
    if (suggestions.length > 0) {
      return (
        <View style={styles.suggestionsContainer}>
          {suggestions.map(breed => (
            <TouchableOpacity
              key={breed.id}
              style={styles.suggestionItem}
              onPress={() => handleSuggestionPress(breed)}
              activeOpacity={0.7}
            >
              <Ionicons name="search" size={16} color={Colors.textLight} />
              <Text style={styles.suggestionText}>
                {breed.name}
                <Text style={styles.suggestionEn}> {breed.nameEn}</Text>
              </Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.textLight} />
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    // 无输入时显示历史和热门
    if (!searchQuery.trim()) {
      return (
        <View style={styles.suggestionsContainer}>
          {/* 搜索历史 */}
          {history.length > 0 && (
            <View style={styles.historySection}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>搜索历史</Text>
                <TouchableOpacity onPress={clearHistory}>
                  <Text style={styles.clearBtn}>清除</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.historyTags}>
                {history.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.historyTag}
                    onPress={() => handleHistoryPress(item)}
                  >
                    <Text style={styles.historyTagText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* 热门搜索 */}
          <View style={styles.hotSection}>
            <Text style={styles.historyTitle}>热门搜索</Text>
            <View style={styles.historyTags}>
              {HOT_SEARCHES.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.historyTag, styles.hotTag]}
                  onPress={() => handleHotSearchPress(item)}
                >
                  <Ionicons
                    name="flame-outline"
                    size={12}
                    color={Colors.secondary}
                    style={{ marginRight: 2 }}
                  />
                  <Text style={[styles.historyTagText, styles.hotTagText]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      );
    }

    return null;
  };

  /** 列表头部：筛选栏 + 排序 */
  const renderListHeader = () => (
    <View style={styles.listHeader}>
      <View style={styles.resultInfo}>
        <Text style={styles.resultCount}>
          共 <Text style={styles.resultCountBold}>{results.length}</Text> 个品种
        </Text>
      </View>
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.sortBtn}
          onPress={toggleSort}
          activeOpacity={0.7}
        >
          <Ionicons
            name={sortBy === 'popularity' ? 'flame-outline' : 'text-outline'}
            size={16}
            color={Colors.textSecondary}
          />
          <Text style={styles.sortBtnText}>
            {sortBy === 'popularity' ? '热度' : '名称'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]}
          onPress={() => setShowFilter(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="options-outline"
            size={16}
            color={hasActiveFilters ? Colors.primary : Colors.textSecondary}
          />
          <Text
            style={[
              styles.filterBtnText,
              hasActiveFilters && styles.filterBtnTextActive,
            ]}
          >
            筛选
            {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 搜索栏 */}
      <View style={styles.searchBar}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View
          style={[
            styles.searchInputWrap,
            isFocused && styles.searchInputWrapFocused,
          ]}
        >
          <Ionicons
            name="search"
            size={18}
            color={isFocused ? Colors.primary : Colors.textSecondary}
          />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="搜索品种名称、英文名、产地..."
            placeholderTextColor={Colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            onSubmitEditing={handleSubmitSearch}
            returnKeyType="search"
            autoFocus={!initialQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchBtn}
            >
              <Ionicons name="close-circle" size={18} color={Colors.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 搜索建议 / 搜索结果 */}
      {isFocused && !searchQuery.trim() ? (
        renderSuggestions()
      ) : isFocused && suggestions.length > 0 ? (
        renderSuggestions()
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderEmpty}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
        />
      )}

      {/* 筛选面板 */}
      <SearchFilter
        visible={showFilter}
        filters={filters}
        onConfirm={handleFilterConfirm}
        onReset={handleFilterReset}
        onClose={() => setShowFilter(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // 搜索栏
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    height: 40,
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  searchInputWrapFocused: {
    borderColor: Colors.primary + '40',
    backgroundColor: Colors.surface,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    padding: 0,
  },
  clearSearchBtn: {
    padding: 2,
  },
  // 列表头部
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  resultInfo: {
    flex: 1,
  },
  resultCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  resultCountBold: {
    fontWeight: '700',
    color: Colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortBtnText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: {
    backgroundColor: Colors.primary + '12',
    borderColor: Colors.primary,
  },
  filterBtnText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterBtnTextActive: {
    color: Colors.primary,
  },
  listContent: {
    paddingBottom: 100,
  },
  // 空状态
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl * 2,
    paddingHorizontal: Spacing.xl,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.border + '40',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  // 搜索建议
  suggestionsContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  suggestionText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  suggestionEn: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  // 搜索历史
  historySection: {
    marginBottom: Spacing.xl,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  historyTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  clearBtn: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  historyTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  historyTag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
  },
  historyTagText: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  // 热门搜索
  hotSection: {
    marginBottom: Spacing.xl,
  },
  hotTag: {
    backgroundColor: Colors.secondary + '10',
  },
  hotTagText: {
    color: Colors.secondary,
  },
});
