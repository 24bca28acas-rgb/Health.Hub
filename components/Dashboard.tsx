
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ActivityData, FoodHistoryItem } from '../types';
import { Flame, Target, Sparkles, Play, Pause, Plus, Droplets, Zap, Footprints, Settings2, Check, Pencil, Route } from 'lucide-react';
import StreakWidget from './StreakWidget';
import StreakHistory from './StreakHistory';
import { supabase } from '../services/storage';
import { getFastHealthTip } from '../services/geminiService';
import Logo from './Logo';
import { ActivityLogger } from './ActivityLogger';
import GlowingButton from './GlowingButton';

interface DashboardProps {
  data: ActivityData;
  onUpdateGoals: (newGoals: Partial<ActivityData>) => void;
  isTracking: boolean;
  onToggleTracking: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  foodHistory?: FoodHistoryItem[];
  streakValue?: number;
  activityHistory?: any[];
  adaptiveGoalsEnabled: boolean;
  onToggleAdaptiveGoals: (enabled: boolean) => void;
  userWeight?: number;
  profile?: any;
}

const ConcentricHUD: React.FC<{
  stepsProgress: number;
  caloriesProgress: number;
  hydrationProgress: number;
  primaryValue: string;
  primaryLabel: string;
  goalLabel: string;
}> = ({ stepsProgress, caloriesProgress, hydrationProgress, primaryValue, primaryLabel, goalLabel }) => {
  const size = 320;
  const center = size / 2;
  const strokeWidth = 12;

  const rings = [
    { progress: caloriesProgress, color: '#CCFF00', radius: 140 }, // Outer: Calories
    { progress: stepsProgress, color: '#F59E0B', radius: 120 },    // Middle: Steps
    { progress: hydrationProgress, color: '#06B6D4', radius: 100 }, // Inner: Hydration
  ];

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {rings.map((ring, i) => {
          const circumference = 2 * Math.PI * ring.radius;
          const offset = circumference - (Math.min(100, ring.progress) / 100) * circumference;
          
          return (
            <g key={i}>
              {/* Background Track */}
              <circle 
                cx={center} cy={center} r={ring.radius} 
                stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} 
                fill="transparent" 
              />
              {/* Active Progress Arc */}
              <motion.circle 
                cx={center} cy={center} r={ring.radius} 
                stroke={ring.color} strokeWidth={strokeWidth} 
                fill="transparent" 
                strokeDasharray={circumference} 
                initial={{ strokeDashoffset: circumference }} 
                animate={{ strokeDashoffset: offset }} 
                transition={{ duration: 1.5, ease: "easeOut", delay: i * 0.2 }}
                strokeLinecap="round" 
                style={{ filter: `drop-shadow(0 0 8px ${ring.color}44)` }}
              />
            </g>
          );
        })}
      </svg>
      
      {/* Central Metrics Core */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.8 }}
          className="flex flex-col items-center"
        >
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-1">{primaryLabel}</span>
          <h2 className="text-6xl font-black text-white tracking-tighter leading-none">{primaryValue}</h2>
          <span className="text-[10px] font-medium text-gray-600 uppercase tracking-widest mt-3">{goalLabel}</span>
        </motion.div>
      </div>
    </div>
  );
};

const ProgressBar: React.FC<{ label: string; value: React.ReactNode; progress: number; color: string; icon: React.ReactNode }> = ({ label, value, progress, color, icon }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-end">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-white/5 text-gray-400">{icon}</div>
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</span>
      </div>
      <div className="text-xs font-black text-white">{value}</div>
    </div>
    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }} 
        animate={{ width: `${Math.min(100, progress)}%` }} 
        transition={{ duration: 1, ease: "easeOut" }}
        className="h-full rounded-full" 
        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}44` }}
      />
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ 
  data, onToggleTracking, isTracking, onUpdateGoals, onRefresh, foodHistory = [], streakValue = 0, activityHistory = [], userWeight = 70, profile: initialProfile
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [showActivityLogger, setShowActivityLogger] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [aiTip, setAiTip] = useState<string>("Initializing Neural Insights...");
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  
  // Mock hydration for the UI as it's not in ActivityData yet
  const [hydration, setHydration] = useState(0);
  const [hydrationGoal, setHydrationGoal] = useState(2.5);
  const [isEditing, setIsEditing] = useState(false);
  const [isManualHydration, setIsManualHydration] = useState(false);
  const [manualHydrationValue, setManualHydrationValue] = useState("");
  const [editedGoals, setEditedGoals] = useState({
    stepGoal: data.stepGoal,
    hydrationGoal: 2.5,
    calorieGoal: data.calorieGoal
  });

  const addHydration = (amountL: number) => {
    setHydration(prev => parseFloat((prev + amountL).toFixed(2)));
  };

  const handleManualHydrationSubmit = () => {
    const val = parseFloat(manualHydrationValue);
    if (!isNaN(val)) {
      setHydration(val);
      setIsManualHydration(false);
      setManualHydrationValue("");
    }
  };

  // Hydration Reminder System
  useEffect(() => {
    if (typeof window !== 'undefined' && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    const checkHydration = () => {
      const remaining = hydrationGoal - hydration;
      if (remaining > 0) {
        if (typeof window !== 'undefined' && "Notification" in window && Notification.permission === "granted") {
          new Notification("Hydration Protocol", {
            body: `Time to hydrate! You need ${remaining.toFixed(1)} Liters more to reach your daily target.`,
          });
        } else {
          // Fallback or premium toast logic could go here
          console.log(`Hydration Protocol: You need ${remaining.toFixed(1)}L more.`);
        }
      }
    };

    // Set interval for 1 hour (3,600,000 ms)
    const intervalId = setInterval(checkHydration, 3600000);

    // Developer Testing Mode (10 seconds)
    // const intervalId = setInterval(checkHydration, 10000);

    return () => clearInterval(intervalId);
  }, [hydration, hydrationGoal]);

  useEffect(() => {
    if (!isEditing) {
      setEditedGoals({
        stepGoal: data.stepGoal,
        hydrationGoal: hydrationGoal,
        calorieGoal: data.calorieGoal
      });
    }
  }, [data.stepGoal, data.calorieGoal, hydrationGoal, isEditing]);

  const handleSaveGoals = async () => {
    onUpdateGoals({
      stepGoal: editedGoals.stepGoal,
      calorieGoal: editedGoals.calorieGoal
    });
    setHydrationGoal(editedGoals.hydrationGoal);
    setIsEditing(false);

    // SUPABASE INTEGRATION HOOK:
    // if (userId) {
    //   try {
    //     const { error } = await supabase
    //       .from('profiles')
    //       .update({ 
    //         goals: { 
    //           stepGoal: editedGoals.stepGoal, 
    //           calorieGoal: editedGoals.calorieGoal 
    //         } 
    //       })
    //       .eq('id', userId);
    //     if (error) throw error;
    //   } catch (e) {
    //     console.error("Failed to sync goals to Supabase", e);
    //   }
    // }
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: authData }) => { 
      if (authData.user) {
        setUserId(authData.user.id);
        const { data: profile } = await supabase.from('profiles').select('name, metrics').eq('id', authData.user.id).maybeSingle();
        if (!profile || !profile.name || profile.name === 'Elite Member' || profile.name === 'Elite User' || !profile.metrics?.dob) {
          setIsProfileIncomplete(true);
        }
      }
    });
    
    const context = initialProfile ? 
      `${initialProfile.metrics?.height}cm, ${initialProfile.metrics?.weight}kg, ${initialProfile.metrics?.fitnessGoal}` : 
      "175cm, 70kg, Active";
      
    getFastHealthTip(`Steps: ${data.steps}, Goal: ${data.stepGoal}`, context).then(setAiTip);
  }, [data.steps, initialProfile]);

  if (isProfileIncomplete) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-luxury-neon/10 flex items-center justify-center animate-pulse">
          <Target size={40} className="text-luxury-neon" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Identity Required</h2>
        <p className="text-gray-400 text-sm max-w-xs">Your biometric profile is incomplete. Please finalize your setup to access the Performance Hub.</p>
        <GlowingButton 
          onClick={() => window.location.reload()} 
          className="px-10 py-4"
        >
          Initialize Setup
        </GlowingButton>
      </div>
    );
  }

  const caloriesConsumed = foodHistory.reduce((acc, item) => acc + (item.analysis?.macros?.calories || 0), 0);
  const activeCaloriesProgress = (data.calories / data.calorieGoal) * 100;
  const stepsProgress = (data.steps / data.stepGoal) * 100;
  const hydrationProgress = (hydration / hydrationGoal) * 100;

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar p-6 space-y-8 pb-32 bg-[#050505]">
      {/* Header */}
      <div className="flex flex-col items-center mt-12 text-center space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center gap-4"
        >
          <Logo className="h-12 w-auto" />
          <div className="space-y-1">
            <p className="text-[10px] text-luxury-neon font-black uppercase tracking-[0.5em] opacity-80">
              {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'} Protocol
            </p>
            <h1 className="text-4xl font-black text-white tracking-tighter leading-none">
              Welcome, <span className="text-luxury-neon">{initialProfile?.name?.split(' ')[0] || 'Elite'}</span>
            </h1>
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="h-px w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        />
      </div>

      {/* Concentric HUD */}
      <div className="flex flex-col items-center justify-center py-10 relative">
        <ConcentricHUD 
          caloriesProgress={activeCaloriesProgress}
          stepsProgress={stepsProgress}
          hydrationProgress={hydrationProgress}
          primaryValue={Math.floor(data.calories).toLocaleString()}
          primaryLabel="ACTIVE KCAL"
          goalLabel={`OUT OF ${data.calorieGoal.toLocaleString()} GOAL`}
        />
        
        <motion.button
          whileTap={{ scale: 0.95 }} onClick={onToggleTracking}
          className={`mt-12 px-10 py-4 rounded-full flex items-center justify-center gap-3 transition-all duration-300 backdrop-blur-xl ${isTracking ? 'bg-red-500/10 border border-red-500/30 text-red-500' : 'bg-luxury-neon text-black border border-luxury-neon shadow-[0_0_40px_rgba(206,242,69,0.2)]'}`}
        >
          {isTracking ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          <span className="font-black uppercase tracking-widest text-[10px]">{isTracking ? 'Pause Sync' : 'Resume Sync'}</span>
        </motion.button>
      </div>

      {/* AI Insight Card */}
      <motion.div className="glass-panel p-6 rounded-[2.5rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-luxury-neon/10 flex items-center justify-center shrink-0"><Sparkles size={18} className="text-luxury-neon" /></div>
        <div>
          <p className="text-[9px] font-black text-luxury-neon uppercase tracking-[0.2em] mb-1.5">Elite AI Insight</p>
          <p className="text-sm font-medium text-white/80 leading-relaxed italic">"{aiTip}"</p>
        </div>
      </motion.div>

      {/* Daily Targets & Biometrics */}
      <div className="grid grid-cols-1 gap-6">
        <div className="glass-panel p-8 rounded-[2.5rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl space-y-8">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Daily Targets</h3>
            <button 
              onClick={() => isEditing ? handleSaveGoals() : setIsEditing(true)}
              className="p-2 rounded-lg hover:bg-white/5 transition-all group"
            >
              {isEditing ? (
                <Check size={18} className="text-luxury-neon drop-shadow-[0_0_8px_#CCFF00]" />
              ) : (
                <Settings2 size={18} className="text-gray-400 group-hover:text-luxury-neon transition-colors" />
              )}
            </button>
          </div>
          
          <div className="space-y-6">
            <ProgressBar 
              label="Active Steps" 
              value={isEditing ? (
                <div className="flex items-center gap-1">
                  <input 
                    type="number" 
                    value={editedGoals.stepGoal}
                    onChange={(e) => setEditedGoals(prev => ({ ...prev, stepGoal: parseInt(e.target.value) || 0 }))}
                    className="w-16 bg-transparent border-b border-[#CCFF00]/50 text-right outline-none text-luxury-neon"
                  />
                </div>
              ) : `${data.steps.toLocaleString()} / ${data.stepGoal.toLocaleString()}`} 
              progress={stepsProgress} 
              color="#F59E0B" 
              icon={<Footprints size={14} />}
            />
            <div className="space-y-3">
              <ProgressBar 
                label="Hydration Level" 
                value={isEditing ? (
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" 
                      step="0.1"
                      value={editedGoals.hydrationGoal}
                      onChange={(e) => setEditedGoals(prev => ({ ...prev, hydrationGoal: parseFloat(e.target.value) || 0 }))}
                      className="w-12 bg-transparent border-b border-[#CCFF00]/50 text-right outline-none text-luxury-neon"
                    />
                    <span className="text-gray-500">L</span>
                  </div>
                ) : `${hydration}L / ${hydrationGoal}L`} 
                progress={hydrationProgress} 
                color="#06B6D4" 
                icon={<Droplets size={14} />}
              />
              {!isEditing && (
                <div className="flex items-center gap-2 pl-10">
                  {isManualHydration ? (
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                      <input 
                        type="number" 
                        step="0.1"
                        autoFocus
                        value={manualHydrationValue}
                        onChange={(e) => setManualHydrationValue(e.target.value)}
                        placeholder="0.0"
                        className="w-12 bg-transparent outline-none text-[10px] font-bold text-luxury-neon"
                        onKeyDown={(e) => e.key === 'Enter' && handleManualHydrationSubmit()}
                      />
                      <button onClick={handleManualHydrationSubmit} className="text-luxury-neon">
                        <Check size={12} />
                      </button>
                      <button onClick={() => setIsManualHydration(false)} className="text-gray-500">
                        <Plus size={12} className="rotate-45" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button 
                        onClick={() => addHydration(0.25)}
                        className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-[#CCFF00]/50 text-[10px] font-bold text-white transition-all active:scale-95"
                      >
                        + 250ml
                      </button>
                      <button 
                        onClick={() => addHydration(0.5)}
                        className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-[#CCFF00]/50 text-[10px] font-bold text-white transition-all active:scale-95"
                      >
                        + 500ml
                      </button>
                      <button 
                        onClick={() => setIsManualHydration(true)}
                        className="p-1.5 rounded-full bg-white/5 border border-white/10 hover:border-[#CCFF00]/50 text-gray-400 transition-all active:scale-95"
                        title="Manual Entry"
                      >
                        <Pencil size={10} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <ProgressBar 
              label="Caloric Burn" 
              value={isEditing ? (
                <div className="flex items-center gap-1">
                  <input 
                    type="number" 
                    value={editedGoals.calorieGoal}
                    onChange={(e) => setEditedGoals(prev => ({ ...prev, calorieGoal: parseInt(e.target.value) || 0 }))}
                    className="w-16 bg-transparent border-b border-[#CCFF00]/50 text-right outline-none text-luxury-neon"
                  />
                  <span className="text-gray-500">KCAL</span>
                </div>
              ) : `${Math.floor(data.calories)} KCAL`} 
              progress={(data.calories / data.calorieGoal) * 100} 
              color="#CCFF00" 
              icon={<Zap size={14} />}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div 
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowActivityLogger(true)}
            className="glass-panel p-6 rounded-[2.5rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl flex flex-col items-center cursor-pointer hover:bg-white/5 transition-colors relative group"
          >
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <Plus size={14} className="text-luxury-neon" />
            </div>
            <Flame size={20} className="text-luxury-neon mb-3" />
            <span className="text-2xl font-black text-white">{Math.floor(data.calories).toLocaleString()}</span>
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-1">Active KCAL</span>
          </motion.div>

          <div className="glass-panel p-6 rounded-[2.5rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl flex flex-col items-center">
            <Footprints size={20} className="text-luxury-neon mb-3" />
            <span className="text-2xl font-black text-white">{(data.steps || 0).toLocaleString()}</span>
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-1">Total Steps</span>
          </div>
          
          <div className="glass-panel p-6 rounded-[2.5rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl flex flex-col items-center">
            <Route size={20} className="text-luxury-neon mb-3" />
            <span className="text-2xl font-black text-white">{data.distance.toFixed(2)}</span>
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-1">Distance KM</span>
          </div>
        </div>
      </div>

      <StreakWidget 
        completedDates={activityHistory.map(h => h.activity_date)} 
        onSeeMore={() => setShowHistory(true)}
        userId={userId} 
      />

      {showHistory && userId && <StreakHistory userId={userId} onClose={() => setShowHistory(false)} />}
      {showActivityLogger && userId && (
        <ActivityLogger 
          userId={userId} 
          userWeight={userWeight} 
          onClose={() => setShowActivityLogger(false)} 
          onLogSuccess={() => {
            if (onRefresh) onRefresh();
          }} 
        />
      )}
    </div>
  );
};

export default Dashboard;
