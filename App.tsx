
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  User,
  fetchFullUserDashboard,
  supabase,
  getGuestUser,
  sanitizeUserMetadata
} from './services/storage';

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
import { DailyActivityProvider, useDailyActivityData } from './contexts/DailyActivityContext';

const MainContent: React.FC<{
  session: any;
  userProfile: any;
  setUserProfile: any;
  foodHistory: FoodHistoryItem[];
  setFoodHistory: any;
  bmiMetrics: UserMetrics;
  setBmiMetrics: any;
  adaptiveGoalsEnabled: boolean;
  setAdaptiveGoalsEnabled: any;
  currentView: ViewState;
  setCurrentView: any;
}> = ({ session, userProfile, setUserProfile, foodHistory, setFoodHistory, bmiMetrics, setBmiMetrics, adaptiveGoalsEnabled, setAdaptiveGoalsEnabled, currentView, setCurrentView }) => {
  const { steps, calories, distance, hydration, hydrationGoal, streak, history, isTracking, toggleTracking, refresh, isLoading: biometricLoading } = useDailyActivityData();

  const handleAddToFoodHistory = (item: FoodHistoryItem) => {
    setFoodHistory((prev: FoodHistoryItem[]) => [item, ...prev].slice(0, 5));
  };

  if (biometricLoading) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-emerald-500 font-mono text-xs tracking-widest uppercase animate-pulse">
          Synchronizing Health Data...
        </p>
      </div>
    );
  }

  const activityData: ActivityData = {
    steps,
    calories,
    distance,
    hydration,
    stepGoal: userProfile.goals?.stepGoal || 10000,
    calorieGoal: userProfile.goals?.calorieGoal || 2000,
    distanceGoal: 5.0,
    hydrationGoal,
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
                onRefresh={refresh}
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

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAppLoading, setIsAppLoading] = useState(true); // MUST START TRUE
  
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);

  const [bmiMetrics, setBmiMetrics] = useLocalStorage<UserMetrics>('bmi_metrics', { height: 175, weight: 70 });
  const [foodHistory, setFoodHistory] = useLocalStorage<FoodHistoryItem[]>('food_history', []);
  const [adaptiveGoalsEnabled, setAdaptiveGoalsEnabled] = useLocalStorage<boolean>('adaptive_goals_enabled', true);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async (userId: string) => {
      console.log("1. Session ID:", userId);
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        console.log("2. Supabase Profile Data:", profile);
        console.log("3. Supabase Error:", profileError);

        if (isMounted) {
          // Check if profile exists AND a specific field from the setup screen is filled
          if (profile && profile.primary_goal) { 
            console.log("4. Routing to Dashboard - Data found!");
            return profile;
          } else {
            console.log("4. Routing to Setup - Data missing or null!");
            return null;
          }
        }
      } catch (e) {
        console.error("Error fetching profile:", e);
      }
      return null;
    };

    const initializeAuth = async () => {
      try {
        // 1. Fetch Initial Session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        const guestActive = localStorage.getItem('healthy_hub_guest_session') === 'true';
        
        let activeSession = initialSession;
        if (!activeSession && guestActive) {
          const guestUser = getGuestUser();
          if (guestUser) {
            activeSession = { user: guestUser };
          }
        }

        if (activeSession?.user) {
          setSession(activeSession);
          const userId = activeSession.user.id || activeSession.user.uid;
          const profile = await fetchProfile(userId);
          if (isMounted) setUserProfile(profile);
        } else {
          if (isMounted) {
            setSession(null);
            setUserProfile(null);
          }
        }
      } catch (e) {
        console.error("Auth initialization error:", e);
      } finally {
        if (isMounted) setIsAppLoading(false);
      }
    };

    // Single onAuthStateChange listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      
      const guestActive = localStorage.getItem('healthy_hub_guest_session') === 'true';
      let effectiveSession = newSession;
      
      if (!effectiveSession && guestActive) {
        const guestUser = getGuestUser();
        if (guestUser) effectiveSession = { user: guestUser };
      }

      if (effectiveSession?.user) {
        setSession(effectiveSession);
        const userId = effectiveSession.user.id || effectiveSession.user.uid;
        const profile = await fetchProfile(userId);
        if (isMounted) setUserProfile(profile);
      } else {
        if (isMounted) {
          setSession(null);
          setUserProfile(null);
        }
      }
    });

    initializeAuth();

    return () => { 
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 1. BLOCK EVERYTHING UNTIL LOADED
  if (isAppLoading) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-emerald-500 font-mono text-xs tracking-widest uppercase animate-pulse">
          Initializing System...
        </p>
      </div>
    );
  }

  // 2. AUTH BLOCK
  if (!session) {
    return <Auth />;
  }

  // 3. ONBOARDING BLOCK
  if (session && !userProfile) {
    return (
      <OnboardingScreen 
        user={session.user} 
        onComplete={(p) => { 
          setUserProfile(p); 
          setCurrentView(ViewState.DASHBOARD); 
        }} 
      />
    );
  }

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

  return (
    <DailyActivityProvider userId={session.user.id || session.user.uid} stepGoal={userProfile.goals?.stepGoal || 10000}>
      <MainContent 
        session={session}
        userProfile={userProfile}
        setUserProfile={setUserProfile}
        foodHistory={foodHistory}
        setFoodHistory={setFoodHistory}
        bmiMetrics={bmiMetrics}
        setBmiMetrics={setBmiMetrics}
        adaptiveGoalsEnabled={adaptiveGoalsEnabled}
        setAdaptiveGoalsEnabled={setAdaptiveGoalsEnabled}
        currentView={currentView}
        setCurrentView={setCurrentView}
      />
    </DailyActivityProvider>
  );
};

export default App;
