/**
 * 九宫格图片展示组件
 * 1张全宽，2张并排，3-9张九宫格
 */

import React, { useState } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing } from '../../utils/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 4;
const GRID_PADDING = Spacing.lg * 2;
const AVAILABLE_WIDTH = SCREEN_WIDTH - GRID_PADDING;
const SINGLE_IMAGE_MAX_HEIGHT = 240;

interface ImageGridProps {
  images: string[];
  onImagePress?: (index: number) => void;
  maxWidth?: number;
}

export default function ImageGrid({ images, onImagePress, maxWidth }: ImageGridProps) {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const handlePress = (index: number) => {
    if (onImagePress) {
      onImagePress(index);
    } else {
      setViewerIndex(index);
      setViewerVisible(true);
    }
  };

  // 单张图片
  if (images.length === 1) {
    return (
      <>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handlePress(0)}
        >
          <Image
            source={{ uri: images[0] }}
            style={styles.singleImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
        <ImageViewerModal
          images={images}
          visible={viewerVisible}
          initialIndex={viewerIndex}
          onClose={() => setViewerVisible(false)}
        />
      </>
    );
  }

  // 两张图片
  if (images.length === 2) {
    const itemSize = ((maxWidth || AVAILABLE_WIDTH) - GRID_GAP) / 2;
    return (
      <>
        <View style={styles.row}>
          {images.map((uri, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={0.9}
              onPress={() => handlePress(i)}
              style={{ marginRight: i === 0 ? GRID_GAP : 0 }}
            >
              <Image
                source={{ uri }}
                style={[styles.gridImage, { width: itemSize, height: itemSize }]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </View>
        <ImageViewerModal
          images={images}
          visible={viewerVisible}
          initialIndex={viewerIndex}
          onClose={() => setViewerVisible(false)}
        />
      </>
    );
  }

  // 3-9张九宫格
  const cols = 3;
  const itemSize = ((maxWidth || AVAILABLE_WIDTH) - GRID_GAP * (cols - 1)) / cols;

  return (
    <>
      <View style={styles.gridContainer}>
        {images.slice(0, 9).map((uri, i) => {
          const rowIndex = Math.floor(i / cols);
          const colIndex = i % cols;
          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.9}
              onPress={() => handlePress(i)}
              style={[
                {
                  marginRight: colIndex < cols - 1 ? GRID_GAP : 0,
                  marginBottom: rowIndex < Math.ceil(images.length / cols) - 1 ? GRID_GAP : 0,
                },
              ]}
            >
              <Image
                source={{ uri }}
                style={[
                  styles.gridImage,
                  { width: itemSize, height: itemSize },
                ]}
                resizeMode="cover"
              />
              {i === 8 && images.length > 9 && (
                <View style={styles.moreOverlay}>
                  <Text style={styles.moreText}>+{images.length - 9}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      <ImageViewerModal
        images={images}
        visible={viewerVisible}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
    </>
  );
}

/** 图片全屏预览 Modal */
function ImageViewerModal({
  images,
  visible,
  initialIndex,
  onClose,
}: {
  images: string[];
  visible: boolean;
  initialIndex: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  React.useEffect(() => {
    if (visible) setCurrentIndex(initialIndex);
  }, [visible, initialIndex]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerContainer}>
        <TouchableOpacity style={styles.viewerClose} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        <Image
          source={{ uri: images[currentIndex] }}
          style={styles.viewerImage}
          resizeMode="contain"
        />

        {images.length > 1 && (
          <View style={styles.viewerNav}>
            <TouchableOpacity
              disabled={currentIndex === 0}
              onPress={() => setCurrentIndex((p) => p - 1)}
              style={[styles.navBtn, currentIndex === 0 && { opacity: 0.3 }]}
            >
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.viewerCount}>
              {currentIndex + 1} / {images.length}
            </Text>
            <TouchableOpacity
              disabled={currentIndex === images.length - 1}
              onPress={() => setCurrentIndex((p) => p + 1)}
              style={[
                styles.navBtn,
                currentIndex === images.length - 1 && { opacity: 0.3 },
              ]}
            >
              <Ionicons name="chevron-forward" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  singleImage: {
    width: '100%',
    height: SINGLE_IMAGE_MAX_HEIGHT,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    backgroundColor: Colors.background,
  },
  row: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.sm,
  },
  gridImage: {
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
  },
  moreOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
  },
  viewerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    bottom: 60,
    gap: 20,
  },
  navBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerCount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
