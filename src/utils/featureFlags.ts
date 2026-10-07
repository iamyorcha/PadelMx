export interface FeatureFlags {
  playoffs: boolean;
  publicViewer: boolean;
  tvMode: boolean;
  globalRankings: boolean;
  experimentalFormats: boolean;
  audioCelebrations: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  playoffs: true,
  publicViewer: true,
  tvMode: true,
  globalRankings: true,
  experimentalFormats: false,
  audioCelebrations: true,
};

const inMemoryOverrides: Partial<Record<keyof FeatureFlags, boolean>> = {};

export function getFeatureFlag(flag: keyof FeatureFlags): boolean {
  // 1. In-memory override (highest precedence, works in SSR and unit tests)
  if (inMemoryOverrides[flag] !== undefined) {
    return inMemoryOverrides[flag]!;
  }

  // 2. Check URL parameters for emergency overrides (e.g. ?ff_playoffs=false)
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlOverride = params.get(`ff_${flag}`);
      if (urlOverride !== null) {
        return urlOverride === 'true' || urlOverride === '1';
      }
    } catch {
      // Ignore URL parse errors
    }

    // 3. Check local storage toggle
    try {
      const local = localStorage.getItem(`padel_ff_${flag}`);
      if (local !== null) {
        return local === 'true' || local === '1';
      }
    } catch {
      // LocalStorage might be restricted
    }
  }

  // 4. Fallback to default
  return DEFAULT_FLAGS[flag];
}

export function setFeatureFlag(flag: keyof FeatureFlags, enabled: boolean): void {
  inMemoryOverrides[flag] = enabled;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(`padel_ff_${flag}`, enabled ? 'true' : 'false');
    } catch {
      // Ignore
    }
  }
}

export function resetFeatureFlags(): void {
  (Object.keys(inMemoryOverrides) as (keyof FeatureFlags)[]).forEach((k) => {
    delete inMemoryOverrides[k];
  });

  if (typeof localStorage !== 'undefined') {
    try {
      Object.keys(DEFAULT_FLAGS).forEach((k) => {
        localStorage.removeItem(`padel_ff_${k}`);
      });
    } catch {
      // Ignore
    }
  }
}
