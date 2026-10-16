export function useHaptics() {
  const trigger = (pattern: number | number[]) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore if user preference or platform blocks vibration
      }
    }
  };

  return {
    lightTap: () => trigger(15),
    mediumTap: () => trigger(35),
    heavyTap: () => trigger(60),
    turnSwitched: () => trigger([30, 50, 40]),
    songAdded: () => trigger([20, 40, 20]),
    vetoVoted: () => trigger([50, 80, 50]),
    errorNotice: () => trigger([60, 40, 60, 40, 60]),
  };
}
