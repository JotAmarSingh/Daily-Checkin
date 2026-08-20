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

const MainScreen: React.FC = () => {
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
      <AndroidStatusBar onOpenNotifications={() => setIsNotificationsOpen(true)} />

      {/* Android Material 3 Top App Bar */}
      <AndroidTopAppBar />

      {/* Primary Dynamic Screen View */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {renderActiveView()}
      </main>

      {/* Android Bottom Navigation Bar */}
      <AndroidNavigationBar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Android Notification Center Pull-Down Drawer */}
      <AndroidNotificationCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <DayProvider>
      <AndroidDeviceWrapper>
        <MainScreen />
      </AndroidDeviceWrapper>
    </DayProvider>
  );
}
