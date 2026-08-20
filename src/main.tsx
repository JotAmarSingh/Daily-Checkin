import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { isNativeAndroidApp } from './utils/platform';

// Register Service Worker for PWA offline & standalone installation
if (!isNativeAndroidApp() && 'serviceWorker' in navigator && Boolean((import.meta as any).env?.PROD)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration note:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
