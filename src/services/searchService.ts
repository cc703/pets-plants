import { breeds, getBreedById } from '../data/breeds';
import type { Breed, Species } from '../types';

/** 搜索排序方式 */
export type SortBy = 'popularity' | 'name';

/** 搜索筛选条件 */
export interface SearchFilters {
  /** 物种筛选 */
  species?: Species | 'all';
  /** 体型筛选（多选） */
  sizes?: string[];
  /** 毛长筛选（多选） */
  coatLengths?: string[];
  /** 适合人群筛选（多选） */
  suitableFor?: string[];
}

/** 搜索参数 */
export interface SearchParams {
  /** 搜索关键词 */
  query?: string;
  /** 筛选条件 */
  filters?: SearchFilters;
  /** 排序方式 */
  sortBy?: SortBy;
}

/** 全部可用的体型选项 */
export const SIZE_OPTIONS = ['小型', '中型', '大型', '巨型'] as const;

/** 全部可用的毛长选项 */
export const COAT_LENGTH_OPTIONS = ['短毛', '中毛', '长毛', '无毛'] as const;

/** 全部可用的物种选项 */
export const SPECIES_OPTIONS: { key: Species | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'cat', label: '猫咪' },
  { key: 'dog', label: '狗狗' },
];

/** 获取所有适合人群选项 */
export const getSuitableForOptions = (): string[] => {
  const set = new Set<string>();
  breeds.forEach(b => b.suitableFor.forEach(s => set.add(s)));
  return Array.from(set).sort();
};

/** 热门搜索推荐词 */
export const HOT_SEARCHES = [
  '布偶猫', '金毛', '柯基', '泰迪', '哈士奇',
  '英短', '柴犬', '拉布拉多', '暹罗猫', '萨摩耶',
];

/**
 * 核心搜索函数
 * 支持中英文名称匹配、特征筛选、排序
 */
export function searchBreeds(params: SearchParams): Breed[] {
  const { query = '', filters = {}, sortBy = 'popularity' } = params;
  const { species = 'all', sizes, coatLengths, suitableFor } = filters;

  let results = [...breeds];

  // 1. 物种筛选
  if (species && species !== 'all') {
    results = results.filter(b => b.species === species);
  }

  // 2. 体型筛选（多选）
  if (sizes && sizes.length > 0) {
    results = results.filter(b => sizes.includes(b.appearance.size));
  }

  // 3. 毛长筛选（多选）
  if (coatLengths && coatLengths.length > 0) {
    results = results.filter(b => coatLengths.includes(b.appearance.coatLength));
  }

  // 4. 适合人群筛选（多选）
  if (suitableFor && suitableFor.length > 0) {
    results = results.filter(b =>
      suitableFor.some(s => b.suitableFor.includes(s))
    );
  }

  // 5. 关键词搜索（中英文名称、产地、性格关键词）
  if (query.trim()) {
    const q = query.toLowerCase().trim();
    results = results.filter(breed => {
      const nameMatch = breed.name.toLowerCase().includes(q);
      const nameEnMatch = breed.nameEn.toLowerCase().includes(q);
      const countryMatch = breed.originCountry.toLowerCase().includes(q);
      const keywordMatch = breed.temperament.keywords.some(k =>
        k.toLowerCase().includes(q)
      );
      const colorMatch = breed.appearance.coatColors.some(c =>
        c.toLowerCase().includes(q)
      );
      const suitableMatch = breed.suitableFor.some(s =>
        s.toLowerCase().includes(q)
      );
      return (
        nameMatch ||
        nameEnMatch ||
        countryMatch ||
        keywordMatch ||
        colorMatch ||
        suitableMatch
      );
    });
  }

  // 6. 排序
  if (sortBy === 'name') {
    results.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  } else {
    // 按热度（popularityRank 升序，数字越小越热门）
    results.sort((a, b) => a.popularityRank - b.popularityRank);
  }

  return results;
}

/**
 * 快速搜索（用于实时搜索建议）
 * 只匹配名称，返回前 N 条
 */
export function quickSearch(query: string, limit = 5): Breed[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  return breeds
    .filter(
      b =>
        b.name.toLowerCase().includes(q) ||
        b.nameEn.toLowerCase().includes(q)
    )
    .slice(0, limit);
}
