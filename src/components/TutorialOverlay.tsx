import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Zap, CalendarClock, CheckSquare, Clock, BellRing, BarChart3, Database } from 'lucide-react';
import { AndroidTab } from './android/AndroidNavigationBar';

type TutorialStep = {
  title: string;
  summary: string;
  actions: string[];
  tab?: AndroidTab;
  icon: React.ComponentType<{ className?: string }>;
};

const STEPS: TutorialStep[] = [
  { title: 'Today', summary: 'Start here to tell DayTrace what is happening right now.', actions: ['Type a natural-language update in the check-in box.', 'Review the next best action selected from your active work.', 'Update location and energy when your context changes.'], tab: 'hub', icon: Zap },
  { title: 'Timetable', summary: 'Build repeatable blocks for work, family, fitness, and content.', actions: ['Add a time block or begin with a preset.', 'Choose its days, location, and target.', 'Mark each block active, complete, or skipped as the day changes.'], tab: 'timetable', icon: CalendarClock },
  { title: 'Tasks', summary: 'Keep every commitment in the correct working state.', actions: ['Capture a task, category, owner, and priority.', 'Move actionable work to Next or Active.', 'Use Waiting and Blocked when the next move belongs elsewhere.'], tab: 'board', icon: CheckSquare },
  { title: 'Timeline', summary: 'Maintain a factual chronology of what actually happened.', actions: ['Log arrivals, departures, interruptions, and progress.', 'Compare planned and actual times.', 'Use this record for an objective end-of-day review.'], tab: 'timeline', icon: Clock },
  { title: 'Anchors & reminders', summary: 'Protect fixed commitments and receive native notifications.', actions: ['Add meetings and appointments as anchors.', 'Create time, location, or event-triggered reminders.', 'Allow Android notifications when prompted.'], tab: 'reminders', icon: BellRing },
  { title: 'Review', summary: 'Close the day without losing unfinished work.', actions: ['Generate the offline daily review.', 'Check completed, waiting, blocked, and carry-forward items.', 'Copy the report when you want to share or archive it.'], tab: 'review', icon: BarChart3 },
  { title: 'Backup & restore', summary: 'Keep a portable copy of your DayTrace information.', actions: ['Tap the spreadsheet icon in the top bar.', 'Download a JSON backup or copy CSV tabs.', 'Paste a previous JSON backup to restore it.'], icon: Database },
];

interface TutorialOverlayProps {
  onClose: () => void;
  onNavigate: (tab: AndroidTab) => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onClose, onNavigate }) => {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="DayTrace tutorial">
      <div className="w-full max-w-md rounded-[32px] border border-[#44474E]/60 bg-[#1D2026] text-[#E2E2E6] shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-[#44474E]/40 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#334867] flex items-center justify-center"><Icon className="w-5 h-5 text-[#D1E1FF]" /></div>
            <div><div className="text-[10px] uppercase tracking-wider text-[#C4C6D0]">Guide {index + 1} of {STEPS.length}</div><h2 className="font-bold text-base">{step.title}</h2></div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-[#2E3036] text-[#C4C6D0]" aria-label="Close tutorial"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-[#C4C6D0] leading-relaxed">{step.summary}</p>
          <ol className="space-y-3">
            {step.actions.map((action, actionIndex) => <li key={action} className="flex gap-3 text-sm"><span className="shrink-0 w-6 h-6 rounded-full bg-[#334867] text-[#D1E1FF] flex items-center justify-center text-xs font-bold">{actionIndex + 1}</span><span className="pt-0.5">{action}</span></li>)}
          </ol>
          {step.tab && <button onClick={() => { onNavigate(step.tab!); onClose(); }} className="w-full py-2.5 rounded-2xl bg-[#D1E1FF] text-[#003062] font-bold text-xs">Open {step.title}</button>}
        </div>
        <div className="px-5 py-4 border-t border-[#44474E]/40 flex items-center justify-between">
          <button onClick={() => setIndex(index - 1)} disabled={index === 0} className="p-2.5 rounded-xl bg-[#2E3036] disabled:opacity-30" aria-label="Previous tutorial step"><ChevronLeft className="w-4 h-4" /></button>
          <div className="flex gap-1.5">{STEPS.map((item, dotIndex) => <button key={item.title} onClick={() => setIndex(dotIndex)} className={`h-2 rounded-full transition-all ${dotIndex === index ? 'w-6 bg-[#D1E1FF]' : 'w-2 bg-[#44474E]'}`} aria-label={`Open ${item.title} guide`} />)}</div>
          {index < STEPS.length - 1 ? <button onClick={() => setIndex(index + 1)} className="p-2.5 rounded-xl bg-[#334867] text-[#D1E1FF]" aria-label="Next tutorial step"><ChevronRight className="w-4 h-4" /></button> : <button onClick={onClose} className="px-3 py-2 rounded-xl bg-[#D1E1FF] text-[#003062] text-xs font-bold">Done</button>}
        </div>
      </div>
    </div>
  );
};
