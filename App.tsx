
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
  const { steps, calories, distance, hydration, hydrationGoal, caloriesConsumed, streak, history, isTracking, toggleTracking, refresh, isLoading: biometricLoading, updateOptimistically } = useDailyActivityData();

  const handleAddToFoodHistory = async (item: FoodHistoryItem) => {
    setFoodHistory((prev: FoodHistoryItem[]) => [item, ...prev].slice(0, 5));
    
    const calories = item.analysis?.macros?.calories || 0;
    if (calories > 0) {
      // Optimistic Update
      updateOptimistically({ caloriesConsumed: caloriesConsumed + calories });
      
      // Persist to DB
      try {
        const { logCalorieIntake } = await import('./services/storage');
        await logCalorieIntake(session.user.id || session.user.uid, calories);
      } catch (error) {
        console.error("Failed to log food calories to activity:", error);
      }
    }
  };

  if (biometricLoading) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-emerald-500 font-mono text-xs tracking-widest uppercase animate-pulse mb-2">
          Synchronizing Health Data...
        </p>
        <p className="text-gray-500 text-[10px] uppercase tracking-widest max-w-xs">
          Fetching your latest biometric records from the server
        </p>
        
        {/* Force Bypass Button after 5 seconds */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 5 }}
          onClick={() => updateOptimistically({})} // This doesn't set isLoading false, but we can add a way to bypass
          className="mt-8 px-4 py-2 border border-white/10 rounded-full text-[10px] text-gray-500 uppercase tracking-widest hover:bg-white/5 transition-colors"
        >
          Skip Sync
        </motion.button>
      </div>
    );
  }

  const activityData: ActivityData = {
    steps,
    calories,
    distance,
    hydration,
    caloriesConsumed,
    stepGoal: (userProfile.goals?.stepGoal || 10000) + (userProfile.penaltySteps || 0),
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
                onUpdateGoals={async (newGoals) => {
                  if (userProfile) {
                    const updatedProfile = {
                      ...userProfile,
                      goals: {
                        ...userProfile.goals,
                        ...newGoals
                      }
                    };
                    setUserProfile(updatedProfile);
                    const { updateProfile } = await import('./services/storage');
                    await updateProfile(session.user.id || session.user.uid, { goals: updatedProfile.goals });
                  }
                }} 
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
                onUpdateProfile={setUserProfile}
                onUpdateOptimistically={updateOptimistically}
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
              <ProfileScreen user={session.user} onUpdateMetrics={setBmiMetrics} onUpdateProfile={setUserProfile} />
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
      if (userId.startsWith('guest_')) {
        return { id: userId, name: 'Guest User', primary_goal: 'General Health' } as any;
      }
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
      // Safety timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn("Auth initialization timed out, forcing loading state to false");
          setIsAppLoading(false);
        }
      }, 8000);

      try {
        // 1. Fetch Initial Session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        const guestActive = localStorage.getItem('healthy_hub_guest_session') === 'true';
        
        let activeSession = initialSession;
        if (!activeSession && guestActive) {
          const guestUser = getGuestUser();
          if (guestUser) {
            activeSession = { user: guestUser } as any;
          }
        }

        if (activeSession?.user) {
          setSession(activeSession);
          const userId = (activeSession.user as any).id;
          const profile = await fetchProfile(userId);
          if (isMounted) {
            setUserProfile(profile);
            if (profile?.metrics) {
              setBmiMetrics(profile.metrics);
            }
          }
        } else {
          if (isMounted) {
            setSession(null);
            setUserProfile(null);
          }
        }
      } catch (e) {
        console.error("Auth initialization error:", e);
      } finally {
        clearTimeout(timeoutId);
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
        if (guestUser) effectiveSession = { user: guestUser } as any;
      }

      if (effectiveSession?.user) {
        setSession(effectiveSession);
        const userId = (effectiveSession.user as any).id;
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
  useEffect(() => {
    if (isAppLoading) {
      const timer = setTimeout(() => {
        console.warn("Global App Initialization Timeout hit. Forcing bypass.");
        setIsAppLoading(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [isAppLoading]);

  if (isAppLoading) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-emerald-500 font-mono text-xs tracking-widest uppercase animate-pulse mb-2">
          Initializing System...
        </p>
        <p className="text-gray-500 text-[10px] uppercase tracking-widest max-w-xs">
          Establishing secure connection to health network
        </p>
        
        {/* Force Bypass Button after 5 seconds */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 5 }}
          onClick={() => setIsAppLoading(false)}
          className="mt-8 px-4 py-2 border border-white/10 rounded-full text-[10px] text-gray-500 uppercase tracking-widest hover:bg-white/5 transition-colors"
        >
          Force Bypass
        </motion.button>
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
    <DailyActivityProvider userId={session.user.id || session.user.uid} stepGoal={(userProfile.goals?.stepGoal || 10000) + (userProfile.penaltySteps || 0)}>
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
