
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ActivityData, FoodHistoryItem } from '../types';
import { Flame, Footprints, Target, Sparkles, Play, Pause } from 'lucide-react';
import StreakWidget from './StreakWidget';
import StreakHistory from './StreakHistory';
import { supabase } from '../services/supabase';
import { getFastHealthTip } from '../services/geminiService';
import Logo from './Logo';

interface DashboardProps {
  data: ActivityData;
  onUpdateGoals: (newGoals: Partial<ActivityData>) => void;
  isTracking: boolean;
  onToggleTracking: () => Promise<void>;
  foodHistory?: FoodHistoryItem[];
  streakValue?: number;
  activityHistory?: any[];
  adaptiveGoalsEnabled: boolean;
  onToggleAdaptiveGoals: (enabled: boolean) => void;
}

const ProgressRing: React.FC<{ 
  progress: number; 
  color: string; 
  icon: React.ReactNode;
  size?: number;
  strokeWidth?: number;
}> = ({ progress, color, icon, size = 100, strokeWidth = 8 }) => {
  const radius = (size / 2) - (strokeWidth * 1.5); 
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, progress) / 100) * circumference;
  const center = size / 2;

  return (
    <div className="relative flex items-center justify-center p-[10px]" style={{ width: size + 20, height: size + 20 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible">
        <circle cx={center} cy={center} r={radius} stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} fill="transparent" />
        <motion.circle 
          cx={center} cy={center} r={radius} stroke={color} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} 
          initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round" style={{ filter: `drop-shadow(0 0 12px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5 }}>
          {icon}
        </motion.div>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ 
  data, onToggleTracking, isTracking, foodHistory = [], streakValue = 0, activityHistory = []
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [aiTip, setAiTip] = useState<string>("Initializing Neural Insights...");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); });
    getFastHealthTip(`Steps: ${data.steps}, Goal: ${data.stepGoal}`).then(setAiTip);
  }, [data.steps]);

  const totalFuel = foodHistory.reduce((acc, item) => acc + (item.analysis?.macros?.calories || 0), 0);
  const progress = (data.steps / data.stepGoal) * 100;

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar p-6 space-y-8 pb-32">
      <div className="flex justify-between items-center mt-4">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-auto" />
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mb-0.5">Performance Hub</p>
            <h1 className="text-2xl font-black text-white tracking-tighter">Elite Status</h1>
          </div>
        </div>
        <motion.div whileTap={{ scale: 0.9 }} className="flex items-center gap-2 px-4 py-2 bg-luxury-neon/10 rounded-full border border-luxury-neon/20">
            <Flame size={14} className="text-luxury-neon animate-pulse" />
            <span className="text-xs font-black text-luxury-neon">{streakValue} Day Streak</span>
        </motion.div>
      </div>

      <div className="flex flex-col items-center justify-center py-6">
        <ProgressRing 
          progress={progress} color="#CEF245" size={260} strokeWidth={14}
          icon={
            <div className="flex flex-col items-center justify-center text-center -mt-4">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Today's Progress</p>
              <motion.h2 className="text-6xl font-black text-white leading-none tracking-tighter">{data.steps.toLocaleString()}</motion.h2>
              <div className="mt-4">
                <span className="text-[10px] font-black uppercase text-luxury-neon tracking-widest">Goal: {data.stepGoal}</span>
              </div>
            </div>
          }
        />
        <motion.button
          whileTap={{ scale: 0.95 }} onClick={onToggleTracking}
          className={`mt-10 px-12 py-4 rounded-full flex items-center justify-center gap-3 transition-all duration-300 backdrop-blur-md ${isTracking ? 'bg-red-500/10 border border-red-500 text-red-500' : 'bg-luxury-neon text-black border border-luxury-neon shadow-[0_0_30px_rgba(206,242,69,0.3)]'}`}
        >
          {isTracking ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          <span className="font-black uppercase tracking-widest text-xs">{isTracking ? 'Pause Sync' : 'Resume Sync'}</span>
        </motion.button>
      </div>

      <motion.div className="glass-card p-6 rounded-[2rem] border border-luxury-neon/20 bg-luxury-neon/[0.03] flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-luxury-neon/10 flex items-center justify-center shrink-0"><Sparkles size={18} className="text-luxury-neon" /></div>
        <div>
          <p className="text-[9px] font-black text-luxury-neon uppercase tracking-[0.2em] mb-1">Elite AI Insight</p>
          <p className="text-sm font-medium text-white/90 italic">"{aiTip}"</p>
        </div>
      </motion.div>

      <StreakWidget 
        completedDates={activityHistory.map(h => h.activity_date)} 
        onSeeMore={() => setShowHistory(true)}
        userId={userId} 
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-6 rounded-[2rem] border border-white/5 flex flex-col items-center">
          <Flame size={20} className="text-luxury-neon mb-2" />
          <span className="text-2xl font-black text-white">{Math.floor(data.calories)}</span>
          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Active KCAL</span>
        </div>
        <div className="glass-card p-6 rounded-[2rem] border border-white/5 flex flex-col items-center">
          <Footprints size={20} className="text-luxury-neon mb-2" />
          <span className="text-2xl font-black text-white">{data.distance.toFixed(2)}</span>
          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Distance KM</span>
        </div>
      </div>

      {showHistory && userId && <StreakHistory userId={userId} onClose={() => setShowHistory(false)} />}
    </div>
  );
};

export default Dashboard;
