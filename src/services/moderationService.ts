/**
 * 内容审核服务
 * 敏感词过滤、举报机制
 */

import { request } from './api';

// ==================== 敏感词库 ====================

const SENSITIVE_WORDS: string[] = [
  // 广告
  '加微信', '加QQ', '免费领', '低价', '代购', '刷单', '兼职',
  // 有害内容
  '虐待', '遗弃', '贩卖',
  // 其他
  '赌博', '色情', '暴力',
];

export interface Report {
  id: string;
  targetType: 'post' | 'comment' | 'user';
  targetId: string;
  reason: string;
  detail?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
}

// ==================== Mock 数据 ====================

let reportsData: Report[] = [];

// ==================== 服务方法 ====================

/**
 * 检查文本是否包含敏感词
 * 返回包含的敏感词列表，空数组表示通过
 */
export function checkSensitiveWords(text: string): string[] {
  const found: string[] = [];
  const lowerText = text.toLowerCase();
  for (const word of SENSITIVE_WORDS) {
    if (lowerText.includes(word)) {
      found.push(word);
    }
  }
  return found;
}

/**
 * 过滤敏感词，替换为 ***
 */
export function filterSensitiveWords(text: string): string {
  let result = text;
  for (const word of SENSITIVE_WORDS) {
    const regex = new RegExp(word, 'gi');
    result = result.replace(regex, '*'.repeat(word.length));
  }
  return result;
}

/** 提交举报 */
export async function submitReport(data: {
  targetType: 'post' | 'comment' | 'user';
  targetId: string;
  reason: string;
  detail?: string;
}): Promise<Report> {
  const response = await request<{ code: number; data: Report }>('/api/reports', { method: 'POST', body: data });
  return response.data;
}

/** 获取举报原因选项 */
export function getReportReasons(): { value: string; label: string }[] {
  return [
    { value: 'spam', label: '广告/垃圾信息' },
    { value: 'abuse', label: '辱骂/骚扰' },
    { value: 'violence', label: '暴力/血腥' },
    { value: 'animal_cruelty', label: '虐待动物' },
    { value: 'false_info', label: '虚假信息' },
    { value: 'other', label: '其他原因' },
  ];
}
