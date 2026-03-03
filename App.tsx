
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  onAuthStateChanged,
  User,
  fetchFullUserDashboard
} from './services/supabase';

import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import FoodLens from './components/FoodLens';
import BMIHub from './components/BMIHub';
import MapTrackingScreen from './components/MapTrackingScreen';
import ChatBot from './components/ChatBot';
import ProfileScreen from './components/ProfileScreen';
import OnboardingScreen from './components/OnboardingScreen'; 
import WorkoutLab from './components/WorkoutLab';
import Auth from './components/Auth';
import { ViewState, ActivityData, FoodHistoryItem, UserMetrics } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import useStepTracker from './hooks/useStepTracker';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true); 
  const [isProfileChecking, setIsProfileChecking] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);

  // Biometric Synchronization Hook
  const { steps, calories, distance, streak, history, isTracking, toggleTracking, isLoading: biometricLoading } = useStepTracker(
    currentUser?.id || null, 
    userProfile?.goals?.stepGoal || 10000
  );

  const [bmiMetrics, setBmiMetrics] = useLocalStorage<UserMetrics>('bmi_metrics', { height: 175, weight: 70 });
  const [foodHistory, setFoodHistory] = useLocalStorage<FoodHistoryItem[]>('food_history', []);
  const [adaptiveGoalsEnabled, setAdaptiveGoalsEnabled] = useLocalStorage<boolean>('adaptive_goals_enabled', true);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(async (user) => {
      if (!isMounted) return;
      
      if (user) {
        // Prevent unnecessary state updates if user is already set
        if (currentUser?.id !== user.id) {
          setCurrentUser(user);
        }
        
        setIsProfileChecking(true);
        try {
          const dashboardData = await fetchFullUserDashboard(user.id);
          if (isMounted && dashboardData) {
              setUserProfile(dashboardData.profile);
          }
        } catch (e) {
          console.error("Profile Load Failure:", e);
        } finally {
          if (isMounted) setIsProfileChecking(false);
        }
      } else { 
        if (isMounted) {
          setCurrentUser(null); 
          setUserProfile(null);
        }
      }
      if (isMounted) setIsAuthChecking(false);
    });
    return () => { 
      isMounted = false;
      if (unsubscribe) unsubscribe(); 
    };
  }, [currentUser?.id]);

  const handleAddToFoodHistory = (item: FoodHistoryItem) => {
    setFoodHistory(prev => [item, ...prev].slice(0, 5));
  };

  if (isAuthChecking || biometricLoading) return <div className="h-screen bg-black flex items-center justify-center text-luxury-neon animate-pulse text-[10px] uppercase tracking-[0.3em]">Initialising Ecosystem...</div>;
  if (!currentUser) return <Auth onLoginSuccess={() => {}} />;
  if (isProfileChecking) return <div className="h-screen bg-black flex items-center justify-center text-gray-400 text-[10px] uppercase tracking-[0.3em]">Synchronizing Records...</div>;

  if (!userProfile) {
     return <OnboardingScreen user={currentUser} onComplete={(p) => { setUserProfile(p); setCurrentView(ViewState.DASHBOARD); }} />;
  }

  const activityData: ActivityData = {
    steps,
    calories,
    distance,
    stepGoal: userProfile.goals?.stepGoal || 10000,
    calorieGoal: userProfile.goals?.calorieGoal || 2000,
    distanceGoal: 5.0,
    history: []
  };

  const pageTransition = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { type: 'spring', damping: 25, stiffness: 200 }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white relative overflow-hidden font-sans">
      <main className="flex-1 relative w-full overflow-hidden">
        <AnimatePresence mode="wait">
          {currentView === ViewState.DASHBOARD && (
            <motion.div key="dash" {...pageTransition} className="h-full w-full">
              <Dashboard 
                data={activityData} 
                onUpdateGoals={() => {}} 
                isTracking={isTracking} 
                onToggleTracking={toggleTracking} 
                foodHistory={foodHistory}
                adaptiveGoalsEnabled={adaptiveGoalsEnabled}
                onToggleAdaptiveGoals={setAdaptiveGoalsEnabled}
                streakValue={streak}
                activityHistory={history}
              />
            </motion.div>
          )}
          {currentView === ViewState.CHAT && (
            <motion.div key="chat" {...pageTransition} className="h-full w-full">
              <ChatBot metrics={bmiMetrics} activity={activityData} />
            </motion.div>
          )}
          {currentView === ViewState.FOOD_LENS && (
            <motion.div key="lens" {...pageTransition} className="h-full w-full">
              <FoodLens history={foodHistory} onAddToHistory={handleAddToFoodHistory} />
            </motion.div>
          )}
          {currentView === ViewState.BMI_HUB && (
            <motion.div key="bmi" {...pageTransition} className="h-full w-full">
              <BMIHub />
            </motion.div>
          )}
          {currentView === ViewState.MAP_TRACKER && (
            <motion.div key="map" {...pageTransition} className="h-full w-full">
              <MapTrackingScreen userHeight={bmiMetrics.height} />
            </motion.div>
          )}
          {currentView === ViewState.PROFILE && (
            <motion.div key="profile" {...pageTransition} className="h-full w-full">
              <ProfileScreen onUpdateMetrics={setBmiMetrics} />
            </motion.div>
          )}
          {currentView === ViewState.WORKOUT_LAB && (
            <motion.div key="lab" {...pageTransition} className="h-full w-full">
              <WorkoutLab metrics={bmiMetrics} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Navigation currentView={currentView} setView={setCurrentView} />
    </div>
  );
};

export default App;
