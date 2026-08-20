declare global {
  interface Window {
    DayTraceAndroid?: {
      syncSchedule(payload: string): void;
      processOnDeviceAi?(requestId: string, input: string, stateContext: string): void;
    };
  }
}

export function syncNativeSchedule(state: unknown) {
  try { window.DayTraceAndroid?.syncSchedule(JSON.stringify(state)); }
  catch (error) { console.warn('Native schedule sync unavailable', error); }
}
