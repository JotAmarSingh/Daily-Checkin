import React, { useState, useEffect } from 'react';
import { Sparkles, MapPin, Zap, RefreshCw, FileSpreadsheet, Copy, Check, Download, AlertTriangle, Smartphone, ExternalLink, X } from 'lucide-react';
import { useDay } from '../../context/DayContext';
import { AppMode, EnergyLevel } from '../../types';

interface AndroidTopAppBarProps {
  onOpenSettings?: () => void;
}

export const AndroidTopAppBar: React.FC<AndroidTopAppBarProps> = () => {
  const { state, mode, setMode, setCurrentEnergy, resetToDefault, exportDataJSON, exportDataSheetsCSV, importDataJSON } = useDay();
  const [showEnergyMenu, setShowEnergyMenu] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  const energyOptions: { level: EnergyLevel; label: string; icon: string }[] = [
    { level: 'HIGH_FOCUS', label: 'High Focus', icon: '⚡' },
    { level: 'NORMAL', label: 'Normal', icon: '🌿' },
    { level: 'LOW_ENERGY', label: 'Low Energy', icon: '🔋' },
    { level: 'RUSHED', label: 'Rushed', icon: '⏱️' },
    { level: 'DISTRACTED', label: 'Distracted', icon: '🎯' },
    { level: 'TIRED', label: 'Tired', icon: '🌙' },
  ];

  const modeOptions: { mode: AppMode; label: string; desc: string }[] = [
    { mode: 'ACCOUNTABILITY', label: 'Accountability Mode', desc: 'Directs focus, protects context, enforces priorities' },
    { mode: 'NORMAL_CHAT', label: 'Normal Chat', desc: 'Answers questions without productivity coaching' },
    { mode: 'RESEARCH', label: 'Research Mode', desc: 'Deep dive into topics and information' },
    { mode: 'CREATIVE', label: 'Creative Mode', desc: 'Unstructured idea generation & drafts' },
  ];

  const handleCopySheetsTab = (tabName: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedTab(tabName);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const handleImportSubmit = () => {
    if (!importText.trim()) return;
    const success = importDataJSON(importText);
    if (success) {
      setImportStatus('State restored successfully!');
      setTimeout(() => {
        setShowSyncModal(false);
        setImportStatus(null);
        setImportText('');
      }, 1200);
    } else {
      setImportStatus('Invalid JSON data. Please check format.');
    }
  };

  const sheetsData = exportDataSheetsCSV();

  return (
    <>
      <header id="android-top-app-bar" className="w-full bg-[#111318] px-4 py-2.5 border-b border-[#44474E]/30 flex items-center justify-between z-20">
        {/* Left: App Identity */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#334867] text-[#D1E1FF] flex items-center justify-center font-bold text-sm shadow-md border border-[#D1E1FF]/20">
            <Sparkles className="w-4 h-4 text-[#D1E1FF]" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-sm tracking-tight text-[#E2E2E6]">DayTrack AI</span>
              <button
                id="mode-picker-btn"
                onClick={() => setShowModeMenu(!showModeMenu)}
                className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#2E3036] text-[#D1E1FF] border border-[#44474E]/40 hover:bg-[#334867] transition"
              >
                {mode.replace('_', ' ')}
              </button>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-[#C4C6D0]">
              <span className="flex items-center">
                <MapPin className="w-3 h-3 mr-0.5 text-[#D1E1FF]" />
                {state.current.location}
              </span>
              <span className="text-[#44474E]">•</span>
              <button
                id="energy-picker-btn"
                onClick={() => setShowEnergyMenu(!showEnergyMenu)}
                className="hover:underline flex items-center text-[#E2E2E6] font-medium"
              >
                <Zap className="w-3 h-3 mr-0.5 text-[#D1E1FF]" />
                {state.current.energy}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center space-x-1.5">
          {!isInstalled && (
            <button
              id="install-pixel-btn"
              onClick={handleInstallClick}
              className="px-2.5 py-1 rounded-xl bg-[#334867] hover:bg-[#D1E1FF] text-[#D1E1FF] hover:text-[#003062] text-[11px] font-bold transition flex items-center space-x-1 border border-[#D1E1FF]/30 shadow-xs"
              title="Install Day Tracker app on your Pixel / Android device"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
          )}

          <button
            id="google-sheets-sync-btn"
            onClick={() => setShowSyncModal(true)}
            className="p-2 rounded-xl text-[#C4C6D0] hover:text-[#D1E1FF] hover:bg-[#2E3036] transition"
            title="Google Sheets & Data Sync"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#D1E1FF]" />
          </button>

          <button
            id="reset-day-btn"
            onClick={() => {
              if (confirm('Reset day tracker to default demo state?')) {
                resetToDefault();
              }
            }}
            className="p-2 rounded-xl text-[#C4C6D0] hover:text-[#E2E2E6] hover:bg-[#2E3036] transition"
            title="Reset to default initial state"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mode Picker Menu */}
      {showModeMenu && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowModeMenu(false)}>
          <div className="bg-[#1D2026] text-[#E2E2E6] border border-[#44474E]/50 rounded-[32px] p-5 shadow-2xl max-w-xs w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs font-bold uppercase tracking-wider text-[#C4C6D0]/70">Interaction Mode</div>
            <div className="space-y-1.5">
              {modeOptions.map((opt) => (
                <button
                  key={opt.mode}
                  onClick={() => {
                    setMode(opt.mode);
                    setShowModeMenu(false);
                  }}
                  className={`w-full text-left p-3 rounded-2xl border transition ${
                    mode === opt.mode
                      ? 'bg-[#334867] border-[#D1E1FF]/40 text-[#D1E1FF]'
                      : 'bg-[#2E3036] border-[#44474E]/30 text-[#E2E2E6] hover:bg-[#334867]/60'
                  }`}
                >
                  <div className="font-semibold text-xs text-[#E2E2E6]">{opt.label}</div>
                  <div className="text-[11px] text-[#C4C6D0] mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Energy Level Picker Menu */}
      {showEnergyMenu && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowEnergyMenu(false)}>
          <div className="bg-[#1D2026] text-[#E2E2E6] border border-[#44474E]/50 rounded-[32px] p-5 shadow-2xl max-w-xs w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs font-bold uppercase tracking-wider text-[#C4C6D0]/70">Current Energy State</div>
            <div className="grid grid-cols-2 gap-2">
              {energyOptions.map((opt) => (
                <button
                  key={opt.level}
                  onClick={() => {
                    setCurrentEnergy(opt.level);
                    setShowEnergyMenu(false);
                  }}
                  className={`p-3 rounded-2xl border flex flex-col items-center justify-center text-center transition ${
                    state.current.energy === opt.level
                      ? 'bg-[#D1E1FF] text-[#003062] border-[#D1E1FF] font-bold shadow-md'
                      : 'bg-[#2E3036] border-[#44474E]/40 text-[#E2E2E6] hover:bg-[#334867]'
                  }`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span className="text-xs mt-1 font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Google Sheets / JSON Data Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowSyncModal(false)}>
          <div className="bg-[#1D2026] text-[#E2E2E6] border border-[#44474E]/50 rounded-[36px] p-6 shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-[#44474E]/30">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-[#D1E1FF]" />
                <h3 className="font-bold text-base text-[#E2E2E6]">Shared Source of Truth</h3>
              </div>
              <button onClick={() => setShowSyncModal(false)} className="text-[#C4C6D0] hover:text-[#E2E2E6] text-sm font-semibold">✕</button>
            </div>

            <p className="text-xs text-[#C4C6D0] leading-relaxed">
              Keep your daily state portable across ChatGPT, Gemini, and Google Sheets.
            </p>

            {/* Google Sheets Tabs Copy */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-[#C4C6D0]/70">Google Sheets Data (CSV / Tabular)</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(sheetsData).map((tabName) => (
                  <button
                    key={tabName}
                    onClick={() => handleCopySheetsTab(tabName, sheetsData[tabName])}
                    className="p-3 rounded-2xl border border-[#44474E]/40 bg-[#2E3036] hover:bg-[#334867] flex items-center justify-between text-xs transition"
                  >
                    <span className="font-semibold text-[#E2E2E6]">{tabName} Tab</span>
                    {copiedTab === tabName ? (
                      <span className="text-[#D1E1FF] flex items-center text-[10px] font-bold"><Check className="w-3 h-3 mr-0.5" /> Copied</span>
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-[#C4C6D0]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* JSON Backup & Restore */}
            <div className="space-y-3 pt-3 border-t border-[#44474E]/30">
              <div className="text-xs font-bold uppercase tracking-wider text-[#C4C6D0]/70">JSON Backup & Restore</div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    const dataStr = exportDataJSON();
                    const blob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `daytrack-${state.date}.json`;
                    a.click();
                  }}
                  className="flex-1 py-2.5 px-3 bg-[#2E3036] hover:bg-[#334867] border border-[#44474E]/40 text-[#D1E1FF] rounded-2xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5 text-[#D1E1FF]" />
                  <span>Download Backup</span>
                </button>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] text-[#C4C6D0] font-medium">Paste JSON to Restore:</label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder='{"date": "2026-08-20", "tasks": [...]}'
                  className="w-full h-20 text-xs font-mono p-3 rounded-2xl bg-[#111318] border border-[#44474E]/40 text-[#E2E2E6] placeholder-[#C4C6D0]/40 focus:outline-none focus:ring-2 focus:ring-[#D1E1FF]"
                />
                {importStatus && (
                  <div className="text-xs font-medium text-[#D1E1FF]">{importStatus}</div>
                )}
                <button
                  onClick={handleImportSubmit}
                  disabled={!importText.trim()}
                  className="w-full py-2.5 bg-[#D1E1FF] hover:bg-white text-[#003062] font-bold rounded-2xl text-xs disabled:opacity-40 transition shadow-md"
                >
                  Restore State
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Install on Pixel / Standalone App Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={() => setShowInstallModal(false)}>
          <div className="bg-[#1D2026] text-[#E2E2E6] border border-[#44474E]/50 rounded-[32px] p-6 shadow-2xl max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-[#44474E]/30">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-[#334867] flex items-center justify-center text-[#D1E1FF]">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#E2E2E6]">Install on Your Pixel</h3>
                  <p className="text-[10px] text-[#C4C6D0]">Standalone Material 3 App</p>
                </div>
              </div>
              <button onClick={() => setShowInstallModal(false)} className="p-1 rounded-lg text-[#C4C6D0] hover:text-[#E2E2E6]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#C4C6D0] leading-relaxed">
              <div className="p-3 bg-[#2E3036] rounded-2xl border border-[#44474E]/40 space-y-2">
                <div className="text-[11px] font-bold text-[#D1E1FF] uppercase tracking-wider flex items-center space-x-1">
                  <span>How to install:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-[#E2E2E6]">
                  <li>Open this direct app URL in <strong>Google Chrome</strong>:
                    <div className="mt-1 p-1.5 bg-[#111318] rounded-lg font-mono text-[9px] text-[#D1E1FF] break-all select-all flex items-center justify-between">
                      <span className="truncate">{window.location.origin}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin);
                          alert('Copied direct app link to clipboard!');
                        }}
                        className="ml-1 px-1.5 py-0.5 bg-[#334867] text-[#D1E1FF] rounded text-[9px] font-bold shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                  </li>
                  <li>Tap the <strong>Chrome menu (⋮)</strong> in the top-right corner.</li>
                  <li>Tap <strong>"Install app"</strong> (or <em>"Add to Home screen"</em>).</li>
                  <li>Confirm <strong>"Install"</strong>.</li>
                </ol>
              </div>

              <div className="flex items-center space-x-2 text-[10px] text-[#C4C6D0]/80">
                <Sparkles className="w-3.5 h-3.5 text-[#D1E1FF] shrink-0" />
                <span>Installed apps launch full-screen with offline support and native widgets!</span>
              </div>
            </div>

            <button
              onClick={() => setShowInstallModal(false)}
              className="w-full py-2.5 bg-[#D1E1FF] hover:bg-white text-[#003062] font-bold rounded-2xl text-xs transition shadow-md"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
};

