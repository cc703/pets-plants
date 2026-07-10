import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AudioSource } from 'expo-audio';
import {
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
} from 'expo-audio';

export function useRemoteAudioPlayer() {
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const stop = useCallback(async () => {
    const player = playerRef.current;
    if (!player) {
      setPlayingKey(null);
      return;
    }
    try {
      player.pause();
      await player.seekTo(0);
    } finally {
      setPlayingKey(null);
    }
  }, []);

  const play = useCallback(async (source: AudioSource | string | number, key = String(source)) => {
    if (!source) return;
    if (playingKey === key) {
      await stop();
      return;
    }

    await stop();
    await setAudioModeAsync({ playsInSilentMode: true });
    const player = createAudioPlayer(source, { updateInterval: 500 });
    playerRef.current = player;
    player.play();
    setPlayingKey(key);
  }, [playingKey, stop]);

  useEffect(() => {
    return () => {
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, []);

  return useMemo(() => ({ play, stop, playingKey }), [play, stop, playingKey]);
}

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);

  const startRecording = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw new Error('需要麦克风权限才能录音');
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    setLastRecordingUri(recorder.uri ?? null);
    return recorder.uri ?? null;
  }, [recorder]);

  return {
    recorderState,
    isRecording: recorderState.isRecording,
    lastRecordingUri,
    startRecording,
    stopRecording,
  };
}
