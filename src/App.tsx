import React, { useState } from 'react';
import { DayProvider } from './context/DayContext';
import { AndroidDeviceWrapper } from './components/android/AndroidDeviceWrapper';
import { AndroidStatusBar } from './components/android/AndroidStatusBar';
import { AndroidNotificationCenter } from './components/android/AndroidNotificationCenter';
import { AndroidTopAppBar } from './components/android/AndroidTopAppBar';
import { AndroidNavigationBar, AndroidTab } from './components/android/AndroidNavigationBar';
import { TodayHubView } from './components/views/TodayHubView';
import { TimetableView } from './components/views/TimetableView';
import { TaskBoardView } from './components/views/TaskBoardView';
import { TimelineView } from './components/views/TimelineView';
import { RemindersAnchorsView } from './components/views/RemindersAnchorsView';
import { EndOfDayReviewView } from './components/views/EndOfDayReviewView';
import { isNativeAndroidApp } from './utils/platform';

const MainScreen: React.FC = () => {
  const isNativeAndroid = isNativeAndroidApp();
  const [activeTab, setActiveTab] = useState<AndroidTab>('hub');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'hub':
        return <TodayHubView onNavigateToTimetable={() => setActiveTab('timetable')} />;
      case 'timetable':
        return <TimetableView />;
      case 'board':
        return <TaskBoardView />;
      case 'timeline':
        return <TimelineView />;
      case 'reminders':
        return <RemindersAnchorsView />;
      case 'review':
        return <EndOfDayReviewView />;
      default:
        return <TodayHubView onNavigateToTimetable={() => setActiveTab('timetable')} />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Android System Status Bar (Interactive notification drawer trigger) */}
      {!isNativeAndroid && <AndroidStatusBar onOpenNotifications={() => setIsNotificationsOpen(true)} />}

      {/* Android Material 3 Top App Bar */}
      <AndroidTopAppBar nativeMode={isNativeAndroid} />

      {/* Primary Dynamic Screen View */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {renderActiveView()}
      </main>

      {/* Android Bottom Navigation Bar */}
      <AndroidNavigationBar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Android Notification Center Pull-Down Drawer */}
      {!isNativeAndroid && (
        <AndroidNotificationCenter
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
        />
      )}
    </div>
  );
};

export default function App() {
  const isNativeAndroid = isNativeAndroidApp();
  return (
    <DayProvider>
      {isNativeAndroid ? (
        <div className="w-full h-full bg-[#111318] text-[#E2E2E6] overflow-hidden">
          <MainScreen />
        </div>
      ) : (
        <AndroidDeviceWrapper>
          <MainScreen />
        </AndroidDeviceWrapper>
      )}
    </DayProvider>
  );
}
