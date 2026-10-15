import { DeviceMotion } from 'expo-sensors';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

/**
 * Device tilt as animated values in [-1, 1], used for the moving sheen on document cards
 * (the same "it's alive, not a screenshot" cue swiyu and physical ID holograms use).
 * Stays at 0 when Reduce Motion is on or the sensor is unavailable.
 */
export function useTilt() {
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    let cancelled = false;
    (async () => {
      const [reduce, available] = await Promise.all([
        AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
        DeviceMotion.isAvailableAsync().catch(() => false),
      ]);
      if (cancelled || reduce || !available) return;
      try {
        DeviceMotion.setUpdateInterval(60);
        sub = DeviceMotion.addListener(({ rotation }) => {
        if (!rotation) return;
        const clamp = (v: number) => Math.max(-1, Math.min(1, v));
        Animated.spring(x, { toValue: clamp(rotation.gamma / 0.6), useNativeDriver: true, speed: 8, bounciness: 0 }).start();
        Animated.spring(y, { toValue: clamp((rotation.beta - 0.8) / 0.6), useNativeDriver: true, speed: 8, bounciness: 0 }).start();
        });
      } catch {
        // Sensor not usable on this platform; the sheen stays still.
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [x, y]);

  return { x, y };
}
