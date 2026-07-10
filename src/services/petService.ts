import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VirtualPet } from '../types';

const STORAGE_KEY_PREFIX = 'pet_planet_virtual_pets';
const LAST_DECAY_KEY_PREFIX = 'pet_planet_last_decay';

function getStorageKey(userId?: string | null) {
  return userId ? `${STORAGE_KEY_PREFIX}:${userId}` : STORAGE_KEY_PREFIX;
}

function getLastDecayKey(userId?: string | null) {
  return userId ? `${LAST_DECAY_KEY_PREFIX}:${userId}` : LAST_DECAY_KEY_PREFIX;
}

// ---- 经验与等级系统 ----

/** 每级所需经验：level * BASE_EXP */
const BASE_EXP = 100;

/** 经验 → 等级计算 */
export function calcLevel(exp: number): { level: number; remainder: number } {
  let level = 1;
  let remaining = exp;
  while (remaining >= level * BASE_EXP) {
    remaining -= level * BASE_EXP;
    level += 1;
  }
  return { level, remainder: remaining };
}

/** 当前等级升级所需总经验 */
export function expForLevel(level: number): number {
  return level * BASE_EXP;
}

/** 阶段判定 */
export function calcStage(level: number): VirtualPet['stage'] {
  if (level < 5) return '幼年';
  if (level < 15) return '成年';
  return '老年';
}

// ---- 属性衰减 ----

/** 每次衰减间隔（毫秒）—— 30 分钟 */
export const DECAY_INTERVAL_MS = 30 * 60 * 1000;

/** 每次衰减的数值 */
const DECAY_AMOUNTS = {
  hunger: 3,      // 饥饿值衰减（越低越饿）
  happiness: 2,   // 快乐值衰减
  cleanliness: 2, // 清洁值衰减
  energy: 1,      // 精力衰减
};

/** 同步嵌套的 growth / stats 字段 */
function syncNested(pet: VirtualPet): VirtualPet {
  pet.growth = { level: pet.level, experience: pet.experience, nextLevelExp: 100 };
  pet.stats = { happiness: pet.happiness, hunger: pet.hunger, energy: pet.energy, health: pet.health };
  return pet;
}

/**
 * 对宠物状态执行一次衰减
 * 健康值根据饥饿 / 清洁的低值来影响
 */
export function applyDecay(pet: VirtualPet): VirtualPet {
  const updated = { ...pet };
  updated.hunger = Math.max(0, updated.hunger - DECAY_AMOUNTS.hunger);
  updated.happiness = Math.max(0, updated.happiness - DECAY_AMOUNTS.happiness);
  updated.cleanliness = Math.max(0, updated.cleanliness - DECAY_AMOUNTS.cleanliness);
  updated.energy = Math.max(0, updated.energy - DECAY_AMOUNTS.energy);

  // 健康值受到饥饿和清洁的影响
  if (updated.hunger < 20 || updated.cleanliness < 20) {
    updated.health = Math.max(0, updated.health - 2);
  } else if (updated.hunger > 60 && updated.cleanliness > 60 && updated.health < 100) {
    updated.health = Math.min(100, updated.health + 1);
  }

  return syncNested(updated);
}

// ---- 互动操作 ----

export type InteractionType = 'feed' | 'play' | 'bath' | 'rest';

const INTERACTION_EFFECTS: Record<InteractionType, Partial<VirtualPet>> = {
  feed: { hunger: 25, happiness: 5, health: 3 },
  play: { happiness: 20, energy: -15, hunger: -10 },
  bath: { cleanliness: 30, happiness: 5 },
  rest: { energy: 30, health: 5 },
};

const INTERACTION_EXP: Record<InteractionType, number> = {
  feed: 10,
  play: 15,
  bath: 8,
  rest: 5,
};

export function applyInteraction(pet: VirtualPet, type: InteractionType): VirtualPet {
  const effects = INTERACTION_EFFECTS[type];
  const updated = { ...pet };

  if (effects.hunger !== undefined) {
    updated.hunger = clamp(updated.hunger + effects.hunger, 0, 100);
  }
  if (effects.happiness !== undefined) {
    updated.happiness = clamp(updated.happiness + effects.happiness, 0, 100);
  }
  if (effects.health !== undefined) {
    updated.health = clamp(updated.health + effects.health, 0, 100);
  }
  if (effects.energy !== undefined) {
    updated.energy = clamp(updated.energy + effects.energy, 0, 100);
  }
  if (effects.cleanliness !== undefined) {
    updated.cleanliness = clamp(updated.cleanliness + effects.cleanliness, 0, 100);
  }

  // 增加经验
  const newExp = updated.experience + INTERACTION_EXP[type];
  const { level, remainder } = calcLevel(newExp);
  updated.experience = remainder;
  updated.level = level;
  updated.stage = calcStage(level);

  return syncNested(updated);
}

// ---- 领养 ----

export function createPet(breedId: string, name: string): VirtualPet {
  return {
    id: `pet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    breedId,
    name,
    health: 80,
    happiness: 70,
    hunger: 60,
    energy: 80,
    cleanliness: 70,
    level: 1,
    experience: 0,
    stage: '幼年',
    growth: { level: 1, experience: 0, nextLevelExp: 100 },
    stats: { happiness: 70, hunger: 60, energy: 80, health: 80 },
  };
}

// ---- 持久化 ----

export async function loadPets(userId?: string | null): Promise<VirtualPet[]> {
  try {
    const json = await AsyncStorage.getItem(getStorageKey(userId));
    if (!json) return [];
    return JSON.parse(json) as VirtualPet[];
  } catch {
    return [];
  }
}

export async function savePets(pets: VirtualPet[], userId?: string | null): Promise<void> {
  await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(pets));
}

export async function adoptPet(breedId: string, name: string, userId?: string | null): Promise<VirtualPet> {
  const pets = await loadPets(userId);
  const newPet = createPet(breedId, name);
  pets.push(newPet);
  await savePets(pets, userId);
  return newPet;
}

export async function updatePet(updated: VirtualPet, userId?: string | null): Promise<void> {
  const pets = await loadPets(userId);
  const idx = pets.findIndex(p => p.id === updated.id);
  if (idx >= 0) {
    pets[idx] = updated;
    await savePets(pets, userId);
  }
}

export async function deletePet(petId: string, userId?: string | null): Promise<void> {
  const pets = await loadPets(userId);
  await savePets(pets.filter(p => p.id !== petId), userId);
}

/**
 * 加载宠物并批量应用衰减（基于上次保存时间）
 */
export async function loadPetsWithDecay(userId?: string | null): Promise<VirtualPet[]> {
  const pets = await loadPets(userId);
  if (pets.length === 0) return pets;

  const lastDecayStr = await AsyncStorage.getItem(getLastDecayKey(userId));
  const lastDecay = lastDecayStr ? parseInt(lastDecayStr, 10) : Date.now();
  const now = Date.now();
  const elapsed = now - lastDecay;
  const decayCount = Math.floor(elapsed / DECAY_INTERVAL_MS);

  if (decayCount <= 0) return pets;

  // 最多衰减 48 次（防止长时间未打开应用后宠物直接归零）
  const capped = Math.min(decayCount, 48);
  const updated = pets.map(pet => {
    let result = pet;
    for (let i = 0; i < capped; i++) {
      result = applyDecay(result);
    }
    return result;
  });

  await savePets(updated, userId);
  await AsyncStorage.setItem(getLastDecayKey(userId), String(now));
  return updated;
}

// ---- 工具函数 ----

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
