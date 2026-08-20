/** Reliable native detection for the Android WebView wrapper. */
export function isNativeAndroidApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.DayTraceAndroid) || window.location.hostname === 'appassets.androidplatform.net';
}
