
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityData, FoodHistoryItem } from '../types';
import { Flame, Target, Sparkles, Play, Pause, Plus, Droplets, Zap, Footprints, Settings2, Check, Pencil, Route } from 'lucide-react';
import StreakWidget from './StreakWidget';
import StreakHistory from './StreakHistory';
import { supabase, updateProfile } from '../services/storage';
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
  onUpdateProfile?: (profile: any) => void;
  onUpdateOptimistically?: (updates: any) => void;
}

const ConcentricHUD: React.FC<{
  stepsProgress: number;
  caloriesProgress: number;
  intakeProgress: number;
  data: ActivityData;
}> = ({ stepsProgress, caloriesProgress, intakeProgress, data }) => {
  const [activeMetric, setActiveMetric] = useState<'intake' | 'steps' | 'burn'>('intake');
  const metrics = ['intake', 'steps', 'burn'] as const;

  const handleCycle = () => {
    const currentIndex = metrics.indexOf(activeMetric);
    const nextIndex = (currentIndex + 1) % metrics.length;
    setActiveMetric(metrics[nextIndex]);
  };

  const getMetricDetails = () => {
    switch (activeMetric) {
      case 'intake':
        return {
          value: Math.floor(data.caloriesConsumed).toLocaleString(),
          label: "CALORIE INTAKE",
          goal: `OUT OF ${data.calorieGoal.toLocaleString()} GOAL`,
          color: '#3B82F6'
        };
      case 'steps':
        return {
          value: (data.steps || 0).toLocaleString(),
          label: "STEPS TRACKED",
          goal: `OUT OF ${data.stepGoal.toLocaleString()} GOAL`,
          color: '#F59E0B'
        };
      case 'burn':
        return {
          value: Math.floor(data.calories).toLocaleString(),
          label: "CALORIC BURN",
          goal: `OUT OF ${data.calorieGoal.toLocaleString()} GOAL`,
          color: '#CCFF00'
        };
    }
  };

  const { value, label, goal } = getMetricDetails();
  const size = 320;
  const center = size / 2;
  const strokeWidth = 12;

  const rings = [
    { id: 'intake', progress: intakeProgress, color: '#3B82F6', radius: 140 },   // Outer: Intake (Blue)
    { id: 'burn', progress: caloriesProgress, color: '#CCFF00', radius: 120 }, // Middle: Calories Burned (Neon)
    { id: 'steps', progress: stepsProgress, color: '#F59E0B', radius: 100 },    // Inner: Steps (Orange)
  ];

  return (
    <motion.div 
      onClick={handleCycle}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="relative flex items-center justify-center cursor-pointer group" 
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {rings.map((ring, i) => {
          const isActive = activeMetric === ring.id;
          const circumference = 2 * Math.PI * ring.radius;
          const offset = circumference - (Math.min(100, ring.progress) / 100) * circumference;
          
          return (
            <g key={ring.id}>
              {/* Background Track */}
              <circle 
                cx={center} cy={center} r={ring.radius} 
                stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} 
                fill="transparent" 
              />
              {/* Active Progress Arc */}
              <motion.circle 
                cx={center} cy={center} r={ring.radius} 
                stroke={ring.color} 
                strokeWidth={isActive ? strokeWidth + 4 : strokeWidth} 
                fill="transparent" 
                strokeDasharray={circumference} 
                initial={{ strokeDashoffset: circumference }} 
                animate={{ 
                  strokeDashoffset: offset,
                  opacity: isActive ? 1 : 0.3,
                  strokeWidth: isActive ? strokeWidth + 4 : strokeWidth
                }} 
                transition={{ duration: 1, ease: "easeInOut" }}
                strokeLinecap="round" 
                style={{ filter: isActive ? `drop-shadow(0 0 12px ${ring.color}66)` : 'none' }}
              />
            </g>
          );
        })}
      </svg>
      
      {/* Central Metrics Core */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeMetric}
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center"
          >
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-1">{label}</span>
            <h2 className="text-6xl font-black text-white tracking-tighter leading-none">{value}</h2>
            <span className="text-[10px] font-medium text-gray-600 uppercase tracking-widest mt-3">{goal}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
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
  data, onToggleTracking, isTracking, onUpdateGoals, onRefresh, foodHistory = [], streakValue = 0, activityHistory = [], userWeight = 70, profile: initialProfile, onUpdateProfile, onUpdateOptimistically
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [showActivityLogger, setShowActivityLogger] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [aiTip, setAiTip] = useState<string>("Initializing Neural Insights...");
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [customIntake, setCustomIntake] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedGoals, setEditedGoals] = useState({
    stepGoal: initialProfile?.goals?.stepGoal || 10000,
    calorieGoal: data.calorieGoal
  });

  useEffect(() => {
    if (!isEditing) {
      setEditedGoals({
        stepGoal: initialProfile?.goals?.stepGoal || 10000,
        calorieGoal: data.calorieGoal
      });
    }
  }, [initialProfile?.goals?.stepGoal, data.calorieGoal, isEditing]);

  const handleSaveGoals = async () => {
    onUpdateGoals({
      stepGoal: editedGoals.stepGoal,
      calorieGoal: editedGoals.calorieGoal
    });
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
    if (!userId) {
      supabase.auth.getUser().then(async ({ data: authData }) => { 
        if (authData.user) {
          setUserId(authData.user.id);
          const { data: profile } = await supabase.from('profiles').select('name, metrics').eq('id', authData.user.id).maybeSingle();
          if (!profile || !profile.name || profile.name === 'Elite Member' || profile.name === 'Elite User' || !profile.metrics?.dob) {
            setIsProfileIncomplete(true);
          }
        }
      }).catch(err => console.error("Failed to fetch user:", err));
    }
    
    const context = initialProfile ? 
      `${initialProfile.metrics?.height}cm, ${initialProfile.metrics?.weight}kg, ${initialProfile.metrics?.fitnessGoal}` : 
      "175cm, 70kg, Active";
      
    getFastHealthTip(`Steps: ${data.steps}, Goal: ${data.stepGoal}`, context)
      .then(setAiTip)
      .catch((err) => {
        console.error("Failed to fetch AI tip:", err);
        setAiTip("Optimizing performance...");
      });
  }, [data.steps, initialProfile, userId]);

  const todayKey = new Date().toLocaleDateString('en-CA');
  const isOverLimit = data.caloriesConsumed > data.calorieGoal;
  const excessCalories = Math.max(0, data.caloriesConsumed - data.calorieGoal);

  useEffect(() => {
    if (!initialProfile || !userId) return;

    if (initialProfile.lastPenaltyCalculationDate === todayKey) {
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toLocaleDateString('en-CA');

    const yesterdayActivity = activityHistory.find(a => a.activityDate === yesterdayKey);
    const yesterdayIntake = yesterdayActivity?.caloriesConsumed || 0;

    const yesterdayGoal = initialProfile.goals?.calorieGoal || 2000;
    const yesterdayBurn = yesterdayActivity?.caloriesBurned || 0;

    const yesterdayNet = yesterdayIntake - yesterdayGoal - yesterdayBurn;
    const newPenaltySteps = yesterdayNet > 0 ? Math.floor(yesterdayNet * 25) : 0;

    const previousPenalty = initialProfile.penaltySteps || 0;
    const yesterdaySteps = yesterdayActivity?.steps || 0;
    const yesterdayBaseStepGoal = initialProfile.goals?.stepGoal || 10000;
    
    const stepsAboveBase = Math.max(0, yesterdaySteps - yesterdayBaseStepGoal);
    const unburnedPenalty = Math.max(0, previousPenalty - stepsAboveBase);

    const totalPenaltySteps = unburnedPenalty + newPenaltySteps;

    const updatePenalty = async () => {
      const updates = {
        penaltySteps: totalPenaltySteps,
        lastPenaltyCalculationDate: todayKey
      };
      await updateProfile(userId, updates);
      if (onUpdateProfile) {
        onUpdateProfile({ ...initialProfile, ...updates });
      }
    };

    updatePenalty().catch(err => console.error("Failed to update penalty:", err));
  }, [initialProfile, userId, activityHistory, foodHistory, todayKey, onUpdateProfile]);

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

  const handleLogIntake = async (amount: number) => {
    if (!userId || !onUpdateOptimistically) return;
    
    const previousTotal = data.caloriesConsumed;
    const newTotal = previousTotal + amount;
    
    // 1. Optimistic Update
    onUpdateOptimistically({ caloriesConsumed: newTotal });
    setIsLogging(true);

    try {
      const { logCalorieIntake } = await import('../services/storage');
      await logCalorieIntake(userId, amount);
    } catch (error) {
      console.error("Failed to log intake:", error);
      // 2. Revert on Error
      onUpdateOptimistically({ caloriesConsumed: previousTotal });
      alert("Failed to sync calorie intake. Please try again.");
    } finally {
      setIsLogging(false);
      setCustomIntake('');
    }
  };

  const activeCaloriesProgress = (data.calories / data.calorieGoal) * 100;
  const stepsProgress = (data.steps / data.stepGoal) * 100;
  const intakeProgress = (data.caloriesConsumed / data.calorieGoal) * 100;

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
          intakeProgress={intakeProgress}
          data={data}
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
              label={initialProfile?.penaltySteps ? `Active Steps (+${initialProfile.penaltySteps} Penalty)` : "Active Steps"} 
              value={isEditing ? (
                <div className="flex items-center gap-1">
                  <input 
                    type="number" 
                    value={editedGoals.stepGoal}
                    onChange={(e) => setEditedGoals(prev => ({ ...prev, stepGoal: parseInt(e.target.value) || 0 }))}
                    className="w-16 bg-transparent border-b border-[#CCFF00]/50 text-right outline-none text-luxury-neon"
                  />
                  {initialProfile?.penaltySteps > 0 && <span className="text-red-400 text-[10px] ml-1">+{initialProfile.penaltySteps}</span>}
                </div>
              ) : `${data.steps.toLocaleString()} / ${data.stepGoal.toLocaleString()}`} 
              progress={stepsProgress} 
              color={initialProfile?.penaltySteps > 0 ? "#EF4444" : "#F59E0B"} 
              icon={<Footprints size={14} />}
            />
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
            <ProgressBar 
              label="Calorie Intake" 
              value={`${Math.floor(data.caloriesConsumed)} / ${data.calorieGoal} KCAL`} 
              progress={intakeProgress} 
              color={isOverLimit ? "#EF4444" : "#3B82F6"} 
              icon={<Flame size={14} />}
            />
          </div>
        </div>

        {isOverLimit && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel p-6 rounded-[2.5rem] border border-red-500/30 bg-red-500/10 backdrop-blur-xl flex flex-col items-center text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <Flame size={24} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Limit Exceeded</h3>
              <p className="text-sm text-red-200 mt-1">
                Calorie Limit Exceeded by <span className="font-bold text-red-400">{Math.floor(excessCalories)} Kcal</span>.
              </p>
            </div>
            <GlowingButton 
              onClick={() => {
                // In a real app, this would route to WorkoutLab or suggest a specific workout
                alert(`Suggested Workout: ${Math.ceil(excessCalories / 10)} mins HIIT to burn ${Math.floor(excessCalories)} Kcal!`);
              }} 
              className="w-full py-3 bg-red-500 hover:bg-red-600 text-white border-none shadow-[0_0_20px_rgba(239,68,68,0.4)]"
            >
              Burn it now
            </GlowingButton>
          </motion.div>
        )}

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

        {/* Quick-Log Intake Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-8 rounded-[2.5rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl space-y-6"
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Flame size={20} />
              </div>
              <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Calorie Intake</h3>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-white">{Math.floor(data.caloriesConsumed)}</span>
              <span className="text-[10px] font-bold text-gray-500 ml-2 uppercase">KCAL</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {[100, 300, 500].map((amount) => (
              <motion.button
                key={amount}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleLogIntake(amount)}
                disabled={isLogging}
                className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                +{amount}
              </motion.button>
            ))}
          </div>

          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input 
                type="number" 
                placeholder="Custom Amount..."
                value={customIntake}
                onChange={(e) => setCustomIntake(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-gray-600 outline-none focus:border-blue-500/50 transition-colors"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500 uppercase">KCAL</span>
            </div>
            <GlowingButton 
              onClick={() => handleLogIntake(parseInt(customIntake) || 0)}
              disabled={isLogging || !customIntake}
              className="px-8 bg-blue-500 hover:bg-blue-600 text-white border-none shadow-[0_0_20px_rgba(59,130,246,0.3)]"
            >
              Log
            </GlowingButton>
          </div>
        </motion.div>
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
