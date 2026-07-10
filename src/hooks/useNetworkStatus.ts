import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { getApiBaseUrl } from '../services/apiClient';

interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
}

export default function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
  });
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (Platform.OS === 'web') {
      const handleOnline = () => {
        setStatus(prev => ({ ...prev, isConnected: true, isInternetReachable: true }));
        setShowBanner(false);
      };

      const handleOffline = () => {
        setStatus(prev => ({ ...prev, isConnected: false, isInternetReachable: false }));
        setShowBanner(true);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    } else {
      const syncNativeStatus = async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4000);
          const response = await fetch(`${getApiBaseUrl()}/api/health`, {
            method: 'GET',
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!mounted) return;

          const isConnected = response.ok;
          const isInternetReachable = response.ok;

          setStatus({
            isConnected,
            isInternetReachable,
            type: 'network',
          });
          setShowBanner(!(isConnected && isInternetReachable));
        } catch {
          if (!mounted) return;
          setStatus({ isConnected: true, isInternetReachable: true, type: 'unknown' });
        }
      };

      syncNativeStatus();
      const interval = setInterval(syncNativeStatus, 5000);
      return () => {
        mounted = false;
        clearInterval(interval);
      };
    }
  }, []);

  const hideBanner = useCallback(() => {
    setShowBanner(false);
  }, []);

  return {
    ...status,
    showBanner,
    hideBanner,
  };
}
