
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  User,
  fetchFullUserDashboard,
  supabase,
  getGuestUser,
  sanitizeUserMetadata
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
  const currentUserIdRef = React.useRef<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true); 
  const [isProfileChecking, setIsProfileChecking] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
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

    const loadProfile = async (userId: string) => {
      setIsProfileChecking(true);
      try {
        const dashboardData = await fetchFullUserDashboard(userId);
        if (isMounted && dashboardData) {
            const profile = dashboardData.profile;
            const isIncomplete = !profile.name || 
                                 profile.name === 'Elite Member' || 
                                 profile.name === 'Elite User' || 
                                 !profile.metrics?.dob;
            
            if (isIncomplete) {
              setUserProfile(null);
            } else {
              setUserProfile(profile);
            }
        } else if (isMounted) {
            setUserProfile(null);
        }
      } catch (e: any) {
        console.error("Profile Load Failure:", e);
        if (isMounted) {
          setUserProfile(null);
          if (e.message?.toLowerCase().includes("failed to fetch")) {
            setNetworkError("Network Error: Connection blocked. Please check your connection or adblocker.");
          }
        }
      } finally {
        if (isMounted) setIsProfileChecking(false);
      }
    };

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const guestActive = localStorage.getItem('healthy_hub_guest_session') === 'true';

        if (isMounted) {
          if (session?.user) {
            if (session.access_token && session.access_token.length > 4000) {
              await supabase.auth.signOut({ scope: 'local' });
              setCurrentUser(null);
              setUserProfile(null);
              return;
            }
            localStorage.removeItem('healthy_hub_guest_session');
            currentUserIdRef.current = session.user.id;
            setCurrentUser(session.user);
            await sanitizeUserMetadata(session.user);
            await loadProfile(session.user.id);
          } else if (guestActive) {
            const guestUser = getGuestUser();
            currentUserIdRef.current = guestUser.id;
            setCurrentUser(guestUser);
            await loadProfile(guestUser.id);
          } else {
            currentUserIdRef.current = null;
            setCurrentUser(null);
            setUserProfile(null);
          }
        }
      } catch (e) {
        console.error("Session fetch error:", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      
      const guestActive = localStorage.getItem('healthy_hub_guest_session') === 'true';

      if (session?.user) {
        if (session.access_token && session.access_token.length > 4000) {
          await supabase.auth.signOut({ scope: 'local' });
          setCurrentUser(null);
          setUserProfile(null);
          return;
        }
        localStorage.removeItem('healthy_hub_guest_session');
        if (currentUserIdRef.current !== session.user.id) {
          currentUserIdRef.current = session.user.id;
          setCurrentUser(session.user);
          await sanitizeUserMetadata(session.user);
          await loadProfile(session.user.id);
        }
      } else if (guestActive) {
        const guestUser = getGuestUser();
        if (currentUserIdRef.current !== guestUser.id) {
          currentUserIdRef.current = guestUser.id;
          setCurrentUser(guestUser);
          await loadProfile(guestUser.id);
        }
      } else {
        currentUserIdRef.current = null;
        setCurrentUser(null);
        setUserProfile(null);
      }
    });

    return () => { 
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array prevents infinite re-renders

  const handleAddToFoodHistory = (item: FoodHistoryItem) => {
    setFoodHistory(prev => [item, ...prev].slice(0, 5));
  };

  if (isLoading || biometricLoading) return <div className="h-screen bg-black flex items-center justify-center text-luxury-neon animate-pulse text-[10px] uppercase tracking-[0.3em]">Initialising Ecosystem...</div>;
  if (!currentUser) return <Auth onLoginSuccess={() => {}} />;
  if (isProfileChecking) return <div className="h-screen bg-black flex items-center justify-center text-gray-400 text-[10px] uppercase tracking-[0.3em]">Synchronizing Records...</div>;

  if (networkError) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-red-500 p-6 text-center">
        <div className="mb-4 text-4xl">⚠️</div>
        <h2 className="text-xl font-bold mb-2">Connection Error</h2>
        <p className="text-sm text-gray-400 mb-6">{networkError}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 border border-red-500/30 rounded-full text-red-400 hover:bg-red-500/10 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

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
                userWeight={bmiMetrics.weight}
                profile={userProfile}
              />
            </motion.div>
          )}
          {currentView === ViewState.CHAT && (
            <motion.div key="chat" {...pageTransition} className="h-full w-full">
              <ChatBot profile={userProfile} activity={activityData} />
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
              <MapTrackingScreen userHeight={bmiMetrics.height} userWeight={bmiMetrics.weight} setView={setCurrentView} />
            </motion.div>
          )}
          {currentView === ViewState.PROFILE && (
            <motion.div key="profile" {...pageTransition} className="h-full w-full">
              <ProfileScreen onUpdateMetrics={setBmiMetrics} onUpdateProfile={setUserProfile} />
            </motion.div>
          )}
          {currentView === ViewState.WORKOUT_LAB && (
            <motion.div key="lab" {...pageTransition} className="h-full w-full">
              <WorkoutLab metrics={userProfile.metrics} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Navigation currentView={currentView} setView={setCurrentView} />
    </div>
  );
};

export default App;
