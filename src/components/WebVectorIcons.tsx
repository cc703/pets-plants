import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};

const ICONS: Record<string, string> = {
  add: '+',
  'add-circle-outline': '+',
  'alert-circle': '!',
  'alert-circle-outline': '!',
  'arrow-back': '<',
  'arrow-forward': '>',
  book: 'B',
  'body-outline': 'B',
  calendar: 'D',
  call: 'T',
  'call-outline': 'T',
  checkmark: '✓',
  'checkmark-circle': '✓',
  'checkmark-done': '✓',
  'chatbubble-outline': 'C',
  'chatbubble-ellipses-outline': 'C',
  'chevron-back': '<',
  'chevron-forward': '>',
  close: '×',
  'close-circle': '×',
  'cloud-offline': '!',
  'color-palette-outline': 'C',
  cut: 'S',
  'cut-outline': 'S',
  'document-text-outline': 'D',
  'ear-outline': 'E',
  'eye-outline': '◉',
  'eye-off-outline': '○',
  fitness: 'F',
  gift: 'G',
  'gift-outline': 'G',
  happy: ':)',
  'happy-outline': ':)',
  heart: '♥',
  home: 'H',
  image: 'I',
  'image-outline': 'I',
  leaf: 'L',
  list: '≡',
  location: 'L',
  'location-outline': 'L',
  lock: 'L',
  'lock-closed-outline': 'L',
  mail: 'M',
  'mail-outline': 'M',
  medical: '+',
  medkit: '+',
  mic: 'M',
  moon: 'M',
  'moon-outline': 'M',
  nutrition: 'N',
  'nutrition-outline': 'N',
  notifications: 'N',
  'notifications-off-outline': 'N',
  'notifications-outline': 'N',
  paw: 'P',
  'paw-outline': 'P',
  people: 'P',
  'people-outline': 'P',
  person: 'U',
  'person-add': 'U+',
  'person-circle': 'U',
  'person-outline': 'U',
  play: '▶',
  'play-outline': '▶',
  refresh: '↻',
  'resize-outline': 'R',
  scale: 'S',
  'scale-outline': 'S',
  search: '⌕',
  'search-outline': '⌕',
  send: '➤',
  settings: '⚙',
  'settings-outline': '⚙',
  share: 'S',
  'share-outline': 'S',
  shield: '✓',
  'shield-checkmark-outline': '✓',
  sparkles: '*',
  star: '★',
  stop: '■',
  time: 'T',
  'time-outline': 'T',
  trophy: 'T',
  warning: '!',
};

function WebIcon({ name, size = 20, color = '#111827', style }: IconProps) {
  return (
    <Text
      aria-hidden
      style={[
        {
          color,
          fontSize: Math.max(10, size * 0.78),
          fontWeight: '700',
          lineHeight: size,
          minWidth: size,
          minHeight: size,
          textAlign: 'center',
          includeFontPadding: false,
        },
        style,
      ]}
    >
      {ICONS[name] || '•'}
    </Text>
  );
}

WebIcon.glyphMap = ICONS;

export const Ionicons = WebIcon;
