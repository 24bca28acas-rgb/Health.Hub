import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Flame, Clock, Zap, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/storage';
import { useDailyActivityData } from '../contexts/DailyActivityContext';

interface ActivityLoggerProps {
  userId: string;
  userWeight: number; // in kg
  onClose: () => void;
  onLogSuccess: () => void;
}

const ACTIVITIES = [
  { name: 'Running', met: 9.8 },
  { name: 'Walking', met: 3.8 },
  { name: 'Cycling', met: 7.5 },
  { name: 'Swimming', met: 8 },
  { name: 'HIIT', met: 11 },
  { name: 'Yoga', met: 2.5 },
  { name: 'Strength', met: 5 },
  { name: 'Pilates', met: 3 },
  { name: 'Boxing', met: 9 },
  { name: 'Dance', met: 5 },
  { name: 'Rowing', met: 7 },
  { name: 'Hiking', met: 6 },
  { name: 'Tennis', met: 7.3 },
  { name: 'Other', met: 4 }
];

export const ActivityLogger: React.FC<ActivityLoggerProps> = ({ userId, userWeight, onClose, onLogSuccess }) => {
  const [selectedActivity, setSelectedActivity] = useState(ACTIVITIES[0]);
  const [duration, setDuration] = useState<number>(30);
  const [intensity, setIntensity] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [calories, setCalories] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isManualCalories, setIsManualCalories] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const { calories: currentCalories, updateOptimistically } = useDailyActivityData();

  // 2. Dynamic Calorie Calculation
  useEffect(() => {
    if (isManualCalories) return;

    let multiplier = 1;
    if (intensity === 'Low') multiplier = 0.8;
    if (intensity === 'High') multiplier = 1.2;

    // Formula: Calories = MET * Weight(kg) * Duration(hours)
    const hours = duration / 60;
    const weight = userWeight || 70;
    const calculated = Math.round(selectedActivity.met * multiplier * weight * hours);
    setCalories(calculated);
  }, [selectedActivity, duration, intensity, userWeight, isManualCalories]);

  // 3. The Database Fix (Supabase Integration)
  const handleLogWorkout = async () => {
    if (!userId) {
      setError("User session not found.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Optimistic UI Update
      updateOptimistically({ calories: currentCalories + calories });

      const { error: insertError } = await supabase
        .from('activity_logs')
        .insert({
          userId,
          activityType: selectedActivity.name,
          durationMinutes: duration,
          intensity,
          caloriesBurned: calories,
          notes: notes || `Logged via Elite Activity Tracker`,
          createdAt: new Date().toISOString()
        });

      if (insertError) throw insertError;

      setShowSuccess(true);
      setTimeout(() => {
        onLogSuccess();
        onClose();
      }, 1500);

    } catch (e: any) {
      console.error("❌ LOGGING ERROR:", e);
      // Revert optimistic update on error
      updateOptimistically({ calories: currentCalories });
      setError(e.message || "Failed to sync with neural network.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-24 bg-black/60 backdrop-blur-xl">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-md max-h-[85vh] bg-[#121212] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl relative flex flex-col"
      >
        {/* Success Overlay */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-50 bg-[#121212] flex flex-col items-center justify-center text-center p-6"
            >
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12 }}
              >
                <CheckCircle2 className="text-[#CCFF00] w-20 h-20 mb-4" />
              </motion.div>
              <h3 className="text-2xl font-black text-white uppercase tracking-widest font-cyber">Protocol Logged</h3>
              <p className="text-gray-400 text-sm mt-2">Activity synchronized with elite profile.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-b from-white/5 to-transparent shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#CCFF00]/10 rounded-2xl border border-[#CCFF00]/20">
              <Activity className="text-[#CCFF00]" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter font-cyber">Log Workout</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Elite Tracking Protocol</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 [&::-webkit-scrollbar]:hidden pb-32">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold uppercase tracking-wider">
              <Zap size={14} className="animate-pulse" />
              {error}
            </div>
          )}

          {/* Activity Grid */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Select Discipline</label>
            <div className="grid grid-cols-3 gap-2">
              {ACTIVITIES.map((act) => (
                <button
                  key={act.name}
                  onClick={() => setSelectedActivity(act)}
                  className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                    selectedActivity.name === act.name 
                      ? 'bg-[#CCFF00] text-black border-[#CCFF00]/50 shadow-[0_0_20px_rgba(204,255,0,0.3)]' 
                      : 'bg-white/5 text-gray-400 border-transparent hover:bg-white/10 hover:text-gray-200'
                  }`}
                >
                  {act.name}
                </button>
              ))}
            </div>
          </div>

          {/* Duration & Intensity */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] flex items-center gap-2">
                <Clock size={12} /> Duration
              </label>
              <div className="relative group">
                <input 
                  type="number" 
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full bg-transparent border-b border-white/10 py-2 text-2xl font-black text-white outline-none focus:border-[#CCFF00] transition-colors font-mono"
                />
                <span className="absolute right-0 bottom-2 text-[10px] font-bold text-gray-600 uppercase">Min</span>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] flex items-center gap-2">
                <Zap size={12} /> Intensity
              </label>
              <select 
                value={intensity}
                onChange={(e) => setIntensity(e.target.value as any)}
                className="w-full bg-transparent border-b border-white/10 py-2 text-xl font-black text-white outline-none focus:border-[#CCFF00] transition-colors appearance-none cursor-pointer"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          {/* Est. Burn Card (Glassmorphic) */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500/20 to-transparent blur opacity-50 group-hover:opacity-100 transition duration-1000"></div>
            <div className="relative bg-gradient-to-r from-white/5 to-transparent backdrop-blur-md rounded-3xl p-6 border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                  <Flame className="text-orange-500 animate-pulse" size={24} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Estimated Burn</p>
                  <div className="flex items-baseline gap-2">
                    {isManualCalories ? (
                      <input 
                        type="number" 
                        value={calories}
                        onChange={(e) => setCalories(Number(e.target.value))}
                        className="bg-transparent text-3xl font-black text-white w-24 outline-none border-b border-[#CCFF00]/30 focus:border-[#CCFF00] font-mono"
                        autoFocus
                      />
                    ) : (
                      <span className="text-3xl font-black text-white font-mono">{calories}</span>
                    )}
                    <span className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Kcal</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsManualCalories(!isManualCalories)}
                className="p-2 bg-white/5 rounded-xl text-[10px] font-black text-gray-500 uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"
              >
                {isManualCalories ? 'Auto' : 'Edit'}
              </button>
            </div>
          </div>

          {/* Notes Input */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Session Notes</label>
            <input 
              type="text" 
              placeholder="How did it feel? (Optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm text-gray-300 outline-none focus:border-[#CCFF00]/30 transition-all placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="sticky bottom-0 w-full p-6 bg-[#121212]/90 backdrop-blur-md border-t border-white/5 z-10 shrink-0">
          <motion.button 
            onClick={handleLogWorkout}
            disabled={isSubmitting || showSuccess}
            className="w-full bg-[#121212] text-[#CCFF00] border border-[#CCFF00]/50 px-6 py-5 rounded-2xl font-black uppercase tracking-[0.3em] text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-3 font-cyber"
            // STRICT INITIAL STATE (4 zeros + 0 opacity)
            initial={{ 
              boxShadow: "0px 0px 0px 0px rgba(206, 242, 69, 0)" 
            }}
            // STRICT HOVER STATE (Matching structure)
            whileHover={{ 
              boxShadow: "0px 0px 20px 0px rgba(206, 242, 69, 0.4)" 
            }}
            transition={{ duration: 0.3 }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                LOGGING PROTOCOL...
              </>
            ) : (
              <>
                <Save size={18} /> LOG WORKOUT
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};
