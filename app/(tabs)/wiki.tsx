import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, Shadows } from '../../src/utils/theme';
import { breeds } from '../../src/data/breeds';
import BreedCard from '../../src/components/BreedCard';
import AnimatedListItem from '../../src/components/AnimatedListItem';
import SearchFilter from '../../src/components/SearchFilter';
import useSearchHistory from '../../src/hooks/useSearchHistory';
import {
  searchBreeds,
  quickSearch,
  HOT_SEARCHES,
  type SearchFilters,
} from '../../src/services/searchService';
import type { Breed, Species } from '../../src/types';

export default function WikiPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});

  const { history, addToHistory, removeFromHistory, clearHistory } =
    useSearchHistory();
  const searchInputRef = useRef<TextInput>(null);

  // 使用 searchService 进行筛选
  const filteredBreeds = useMemo(
    () =>
      searchBreeds({
        query: searchQuery,
        filters,
        sortBy: 'popularity',
      }),
    [searchQuery, filters]
  );

  // 搜索建议（实时）
  const suggestions = useMemo(
    () =>
      searchQuery.trim() && isSearchFocused
        ? quickSearch(searchQuery, 5)
        : [],
    [searchQuery, isSearchFocused]
  );

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (query.trim()) {
        addToHistory(query.trim());
      }
    },
    [addToHistory]
  );

  const handleHistoryPress = useCallback((query: string) => {
    setSearchQuery(query);
    setIsSearching(false);
    setIsSearchFocused(false);
    searchInputRef.current?.blur();
  }, []);

  const handleSuggestionPress = useCallback(
    (breed: Breed) => {
      router.push(`/breed/${breed.id}`);
      setIsSearchFocused(false);
      searchInputRef.current?.blur();
    },
    [router]
  );

  const handleFilterConfirm = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
    setShowFilter(false);
  }, []);

  const handleFilterReset = useCallback(() => {
    setFilters({});
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      (filters.species && filters.species !== 'all') ||
      (filters.sizes && filters.sizes.length > 0) ||
      (filters.coatLengths && filters.coatLengths.length > 0) ||
      (filters.suitableFor && filters.suitableFor.length > 0)
    );
  }, [filters]);

  const guideEntries = useMemo(
    () => [
      {
        icon: 'leaf-outline' as const,
        title: '新手友好',
        desc: '低门槛、好照顾',
        filters: { suitableFor: ['新手推荐'] },
      },
      {
        icon: 'home-outline' as const,
        title: '公寓适合',
        desc: '空间压力更小',
        filters: { suitableFor: ['公寓友好'] },
      },
      {
        icon: 'people-outline' as const,
        title: '家庭陪伴',
        desc: '孩子与老人友好',
        filters: { suitableFor: ['有孩家庭', '老人陪伴'] },
      },
    ],
    []
  );

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setFilters({});
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  /** 搜索建议下拉区域 */
  const renderSuggestions = () => {
    if (!isSearchFocused) return null;

    // 实时搜索建议
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
              <Ionicons name="paw-outline" size={16} color={Colors.textLight} />
              <Text style={styles.suggestionText}>
                {breed.name}
                <Text style={styles.suggestionEn}> {breed.nameEn}</Text>
              </Text>
              <View
                style={[
                  styles.suggestionBadge,
                  {
                    backgroundColor:
                      breed.species === 'cat'
                        ? Colors.primary + '15'
                        : Colors.secondary + '15',
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: FontSize.xs,
                    color:
                      breed.species === 'cat'
                        ? Colors.primary
                        : Colors.secondary,
                    fontWeight: '600',
                  }}
                >
                  {breed.species === 'cat' ? '猫' : '狗'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          {/* 跳转完整搜索结果 */}
          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() => {
              addToHistory(searchQuery.trim());
              setIsSearchFocused(false);
              searchInputRef.current?.blur();
              router.push({
                pathname: '/search/result',
                params: { q: searchQuery },
              });
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>
              查看 "{searchQuery}" 的全部结果
            </Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
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
                    <TouchableOpacity
                      onPress={() => removeFromHistory(item)}
                      hitSlop={{
                        top: 10,
                        bottom: 10,
                        left: 10,
                        right: 10,
                      }}
                    >
                      <Ionicons
                        name="close"
                        size={12}
                        color={Colors.textLight}
                      />
                    </TouchableOpacity>
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
                  onPress={() => handleHistoryPress(item)}
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

  const renderHeader = () => (
    <View style={styles.filterArea}>
      <View style={styles.guidePanel}>
        <View style={styles.guidePanelHeader}>
          <Text style={styles.guidePanelTitle}>按养宠场景找品种</Text>
          <Text style={styles.guidePanelSubtitle}>适合准备养宠和正在比较品种的用户</Text>
        </View>
        <View style={styles.guideGrid}>
          {guideEntries.map((entry) => (
            <TouchableOpacity
              key={entry.title}
              style={styles.guideCard}
              activeOpacity={0.75}
              onPress={() => {
                setSearchQuery('');
                setFilters(entry.filters);
              }}
            >
              <View style={styles.guideIconWrap}>
                <Ionicons name={entry.icon} size={16} color={Colors.primary} />
              </View>
              <Text style={styles.guideTitle}>{entry.title}</Text>
              <Text style={styles.guideDesc}>{entry.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 筛选按钮行 */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.filterToggleBtn,
            hasActiveFilters && styles.filterToggleBtnActive,
          ]}
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
              styles.filterToggleText,
              hasActiveFilters && styles.filterToggleTextActive,
            ]}
          >
            筛选
          </Text>
        </TouchableOpacity>
        {(searchQuery.length > 0 || hasActiveFilters) && (
          <TouchableOpacity onPress={clearAllFilters}>
            <Text style={styles.clearFilterText}>清除筛选</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 结果计数 */}
      <View style={styles.resultRow}>
        <Text style={styles.resultCount}>
          共 <Text style={styles.resultCountBold}>{filteredBreeds.length}</Text>{' '}
          个品种
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="search-outline" size={40} color={Colors.textLight} />
      </View>
      <Text style={styles.emptyTitle}>没有找到匹配的品种</Text>
      <Text style={styles.emptySubtitle}>试试其他关键词或调整筛选条件</Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={clearAllFilters}>
        <Text style={styles.emptyBtnText}>重置筛选</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Breed; index: number }) => (
      <AnimatedListItem index={index} delay={50}>
        <BreedCard breed={item} onPress={() => router.push(`/breed/${item.id}`)} />
      </AnimatedListItem>
    ),
    [router]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>品种百科</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.communityBtn}
            onPress={() => router.push('/(tabs)/community')}
          >
            <Ionicons name="people" size={16} color={Colors.primary} />
            <Text style={styles.communityBtnText}>看经验</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={() => router.push('/search/result')}
          >
            <Ionicons name="search" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 搜索框 */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchInputWrap,
            isSearchFocused && styles.searchInputWrapFocused,
          ]}
        >
          <Ionicons
            name="search"
            size={18}
            color={isSearchFocused ? Colors.primary : Colors.textSecondary}
          />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="搜索品种名称、英文名、产地..."
            placeholderTextColor={Colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => {
              setIsSearching(true);
              setIsSearchFocused(true);
            }}
            onBlur={() => {
              setTimeout(() => {
                setIsSearching(false);
                setIsSearchFocused(false);
              }, 200);
            }}
            onSubmitEditing={() => handleSearch(searchQuery)}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchBtn}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={Colors.textLight}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 搜索建议区域（覆盖在列表上方） */}
      {isSearchFocused && renderSuggestions()}

      {/* 品种列表 */}
      {!isSearchFocused && (
        <FlatList
          data={filteredBreeds}
          keyExtractor={item => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  communityBtn: {
    height: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary + '12',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  communityBtnText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '700',
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  filterArea: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  guidePanel: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  guidePanelHeader: {
    marginBottom: Spacing.md,
  },
  guidePanelTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  guidePanelSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  guideGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  guideCard: {
    flex: 1,
    minHeight: 86,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    padding: Spacing.sm,
  },
  guideIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  guideTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  guideDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  // 搜索栏
  searchContainer: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    height: 44,
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...Shadows.sm,
  },
  searchInputWrapFocused: {
    borderColor: Colors.primary + '40',
    ...Shadows.md,
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
  // 筛选按钮行
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  filterToggleBtn: {
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
  filterToggleBtnActive: {
    backgroundColor: Colors.primary + '12',
    borderColor: Colors.primary,
  },
  filterToggleText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  filterToggleTextActive: {
    color: Colors.primary,
  },
  // 结果计数
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultCount: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  resultCountBold: {
    fontWeight: '700',
    color: Colors.text,
  },
  clearFilterText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 100,
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
  suggestionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    marginTop: Spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  viewAllText: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '600',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
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
  emptyBtn: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
  },
  emptyBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.surface,
  },
});
