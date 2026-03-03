
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Dumbbell, Play, Timer, Zap, ChevronRight, Save, Trash2, 
  Loader2, CheckCircle, Sparkles, Plus, Clock, Info, 
  ShieldCheck, RefreshCw, X, ArrowLeft, Target, AlertTriangle, BrainCircuit
} from 'lucide-react';
import { generateWorkoutRoutine } from '../services/geminiService';
import { supabase, fetchSavedWorkouts, saveWorkout, deleteWorkout } from '../services/supabase';
import { WorkoutPlan, UserMetrics, FitnessGoal } from '../types';

interface WorkoutLabProps {
  metrics: UserMetrics;
}

const WorkoutLab: React.FC<WorkoutLabProps> = ({ metrics }) => {
  const [view, setView] = useState<'selection' | 'generating' | 'result' | 'history'>('selection');
  const [savedWorkouts, setSavedWorkouts] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState('');
  const [equipment, setEquipment] = useState('');
  const [goal, setGoal] = useState('');

  const [currentPlan, setCurrentPlan] = useState<WorkoutPlan | null>(null);
  const [isSavedInCurrentSession, setIsSavedInCurrentSession] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [safetyAdvice, setSafetyAdvice] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const history = await fetchSavedWorkouts(user.id);
        setSavedWorkouts(history);
      }
      setLoadingHistory(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (intensity.toLowerCase().includes('elite') || intensity.toLowerCase().includes('extreme')) {
        if (metrics.weight > 100) {
            setSafetyAdvice("Impact warning: high weight + extreme intensity detected. Consider low-impact variants to protect joints.");
        } else {
            setSafetyAdvice(null);
        }
    } else if (duration.toLowerCase().includes('hour') && metrics.activityLevel === 'Sedentary') {
        setSafetyAdvice("Endurance warning: 1h+ sessions might be excessive for current base activity. Consider scaling to 30m.");
    } else {
        setSafetyAdvice(null);
    }
  }, [duration, intensity, metrics]);

  const handleGenerate = async () => {
    setGenerating(true);
    setView('generating');
    try {
      const plan = await generateWorkoutRoutine(
        'Intermediate', 
        goal || metrics.fitnessGoal || 'Optimize performance',
        equipment || 'Any available',
        duration || 'Standard session',
        intensity || 'Variable',
        metrics
      );
      setCurrentPlan(plan);
      setIsSavedInCurrentSession(false);
      setView('result');
    } catch (e) {
      console.error(e);
      setView('selection');
    } finally {
      setGenerating(false);
    }
  };

  const handleSavePlan = async () => {
    if (!userId || !currentPlan || isSavedInCurrentSession) return;
    try {
      await saveWorkout(userId, currentPlan);
      setIsSavedInCurrentSession(true);
      const history = await fetchSavedWorkouts(userId);
      setSavedWorkouts(history);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSaved = async (id: string) => {
    try {
      await deleteWorkout(id);
      setSavedWorkouts(prev => prev.filter(w => w.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (loadingHistory) {
    return (
      <div className="h-full w-full bg-black flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-luxury-neon" size={40} />
      </div>
    );
  }

  const isSelectionValid = duration.trim() || intensity.trim() || equipment.trim() || goal.trim();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="h-full w-full bg-black flex flex-col overflow-hidden relative font-sans">
      <div className="p-8 pt-16 flex justify-between items-center z-10 shrink-0">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter">ELITE <span className="text-luxury-neon">LAB</span></h1>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mt-1">Neural Workout Synth</p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setView(view === 'history' ? 'selection' : 'history')}
          className="w-12 h-12 glass-card rounded-2xl flex items-center justify-center border border-white/10 active:scale-95 transition-all"
        >
          {view === 'history' ? <Plus size={20} className="text-luxury-neon" /> : <Clock size={20} className="text-gray-400" />}
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        <AnimatePresence mode="wait">
          {view === 'selection' && (
            <motion.div 
              key="selection" 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, scale: 0.95 }}
              className="px-8 space-y-8"
            >
              <div className="space-y-6">
                <motion.div variants={itemVariants}>
                  <LuxuryTextField 
                    label="Training Duration" 
                    value={duration} 
                    onChange={setDuration} 
                    placeholder="e.g. 45 minutes"
                    icon={<Timer size={16} />}
                  />
                </motion.div>
                
                <motion.div variants={itemVariants}>
                  <LuxuryTextField 
                    label="Intensity Protocol" 
                    value={intensity} 
                    onChange={setIntensity} 
                    placeholder="e.g. HIIT"
                    icon={<Zap size={16} />}
                  />
                </motion.div>

                <motion.div variants={itemVariants}>
                  <LuxuryTextField 
                    label="Equipment Availability" 
                    value={equipment} 
                    onChange={setEquipment} 
                    placeholder="e.g. Dumbbells"
                    icon={<Dumbbell size={16} />}
                  />
                </motion.div>

                <motion.div variants={itemVariants}>
                  <LuxuryTextField 
                    label="Focus Objective" 
                    value={goal} 
                    onChange={setGoal} 
                    placeholder="e.g. Muscle Gain"
                    icon={<Target size={16} />}
                  />
                </motion.div>
              </div>

              {safetyAdvice && (
                <motion.div variants={itemVariants} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="text-orange-500 shrink-0" size={16} />
                    <p className="text-[10px] font-black text-orange-200 uppercase tracking-widest leading-relaxed">{safetyAdvice}</p>
                </motion.div>
              )}

              <motion.div variants={itemVariants} className="pt-4">
                <button 
                  onClick={handleGenerate}
                  className="w-full py-6 bg-luxury-neon text-black font-black uppercase tracking-[0.2em] rounded-[2rem] shadow-[0_0_30px_rgba(206,242,69,0.3)] flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                  disabled={!isSelectionValid}
                >
                  <Sparkles size={20} /> Synthesize Routine
                </button>
              </motion.div>
            </motion.div>
          )}

          {view === 'generating' && (
            <motion.div 
              key="generating" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="px-8 flex flex-col items-center justify-center h-full text-center py-20"
            >
              <div className="relative mb-12">
                <div className="w-32 h-32 rounded-full border-2 border-white/5 border-t-luxury-neon animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <BrainCircuit className="text-luxury-neon animate-pulse" size={40} />
                </div>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tighter mb-4 uppercase">Optimizing Protocol</h2>
              <p className="text-xs text-gray-500 uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
                Analyzing biometric signatures and manual constraints...
              </p>
            </motion.div>
          )}

          {view === 'result' && currentPlan && (
            <motion.div 
              key="result" 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="px-8 space-y-8"
            >
              <motion.div variants={itemVariants} className="flex items-center gap-4 p-6 glass-card rounded-[2rem] border border-luxury-neon/20">
                <div className="w-14 h-14 rounded-2xl bg-luxury-neon/10 flex items-center justify-center text-luxury-neon">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">{currentPlan.title}</h3>
                  <div className="flex gap-4 mt-1">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{currentPlan.duration}</span>
                    <span className="text-[9px] font-black text-luxury-neon uppercase tracking-widest">{currentPlan.intensity} Intensity</span>
                  </div>
                </div>
              </motion.div>

              <div className="space-y-4">
                {currentPlan.exercises.map((ex, i) => (
                  <motion.div key={i} variants={itemVariants} className="p-6 bg-white/5 border border-white/5 rounded-3xl space-y-3">
                    <div className="flex justify-between items-start">
                      <h4 className="font-black text-white text-lg">{ex.name}</h4>
                      <div className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-luxury-neon uppercase tracking-widest">
                        {ex.sets} × {ex.reps}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed italic">
                      "{ex.notes}"
                    </p>
                  </motion.div>
                ))}
              </div>

              <motion.div variants={itemVariants} className="flex gap-4 pt-4">
                <button 
                  onClick={() => setView('selection')}
                  className="flex-1 py-5 bg-white/5 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-[2rem] border border-white/10"
                >
                  Discard
                </button>
                <button 
                  onClick={handleSavePlan}
                  disabled={isSavedInCurrentSession}
                  className={`flex-1 py-5 font-black uppercase text-[10px] tracking-[0.2em] rounded-[2rem] flex items-center justify-center gap-2 transition-all ${isSavedInCurrentSession ? 'bg-green-500/20 text-green-500 border border-green-500/20' : 'bg-luxury-neon text-black shadow-lg shadow-luxury-neon/20'}`}
                >
                  {isSavedInCurrentSession ? <><CheckCircle size={16} /> Routine Stored</> : <><Save size={16} /> Save Routine</>}
                </button>
              </motion.div>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div 
              key="history" 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="px-8 space-y-6"
            >
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} className="text-gray-500" />
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Archived Sequences</h3>
              </div>
              
              {savedWorkouts.length === 0 ? (
                <div className="p-20 text-center glass-card rounded-[2rem] border border-dashed border-white/10 opacity-50">
                  <p className="text-xs font-black uppercase tracking-widest text-gray-600">No stored protocols</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {savedWorkouts.map((w) => (
                    <motion.div key={w.id} variants={itemVariants} className="p-6 glass-card rounded-[2rem] border border-white/5 group relative">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-black text-white text-lg">{w.plan_data.title}</h4>
                          <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-1">
                            {new Date(w.created_at).toLocaleDateString()} • {w.plan_data.duration}
                          </p>
                        </div>
                        <button 
                          onClick={() => handleDeleteSaved(w.id)}
                          className="p-2 text-gray-700 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <button 
                        onClick={() => {
                          setCurrentPlan(w.plan_data);
                          setIsSavedInCurrentSession(true);
                          setView('result');
                        }}
                        className="w-full py-3 bg-white/5 rounded-xl text-[9px] font-black text-luxury-neon uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                      >
                        Launch Protocol <ChevronRight size={12} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

const LuxuryTextField: React.FC<{ 
  label: string, 
  value: string, 
  placeholder: string, 
  icon?: React.ReactNode,
  onChange: (v: string) => void 
}> = ({ label, value, placeholder, icon, onChange }) => (
  <div className="space-y-2 group">
    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-4 group-focus-within:text-luxury-neon transition-colors">
      {label}
    </label>
    <div className="relative">
      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-luxury-neon transition-colors">
        {icon}
      </div>
      <motion.input 
        whileFocus={{ scale: 1.01 }}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] py-5 pl-14 pr-6 text-sm text-white placeholder-gray-700 outline-none focus:border-luxury-neon/40 focus:bg-white/[0.08] transition-all shadow-inner"
      />
    </div>
  </div>
);

export default WorkoutLab;
