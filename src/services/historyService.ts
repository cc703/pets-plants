import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type BrowsingHistoryType = 'breed' | 'post' | 'user' | 'circle';

export interface BrowsingHistoryItem {
  id: string;
  type: BrowsingHistoryType;
  targetId: string;
  title: string;
  subtitle: string;
  icon: string;
  viewedAt: string;
}

const STORAGE_PREFIX = 'pet_planet_browsing_history';
const MAX_ITEMS = 50;

function getStorageKey(userId?: string | null) {
  return userId ? `${STORAGE_PREFIX}:${userId}` : `${STORAGE_PREFIX}:guest`;
}

async function readStorage(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return AsyncStorage.getItem(key);
}

async function writeStorage(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

export async function getBrowsingHistory(userId?: string | null): Promise<BrowsingHistoryItem[]> {
  try {
    const stored = await readStorage(getStorageKey(userId));
    return stored ? (JSON.parse(stored) as BrowsingHistoryItem[]) : [];
  } catch {
    return [];
  }
}

export async function saveBrowsingHistory(items: BrowsingHistoryItem[], userId?: string | null): Promise<void> {
  await writeStorage(getStorageKey(userId), JSON.stringify(items));
}

export async function addBrowsingHistory(
  item: Omit<BrowsingHistoryItem, 'id' | 'viewedAt'>,
  userId?: string | null,
): Promise<void> {
  const current = await getBrowsingHistory(userId);
  const next = [
    {
      ...item,
      id: `${item.type}:${item.targetId}`,
      viewedAt: new Date().toISOString(),
    },
    ...current.filter((entry) => !(entry.type === item.type && entry.targetId === item.targetId)),
  ].slice(0, MAX_ITEMS);

  await saveBrowsingHistory(next, userId);
}

export async function clearBrowsingHistory(userId?: string | null): Promise<void> {
  await saveBrowsingHistory([], userId);
}

export async function removeBrowsingHistoryItem(id: string, userId?: string | null): Promise<void> {
  const current = await getBrowsingHistory(userId);
  await saveBrowsingHistory(current.filter((item) => item.id !== id), userId);
}
