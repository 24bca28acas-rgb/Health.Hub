import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Activity, Flame, Clock, Zap, Save } from 'lucide-react';
import { logActivity } from '../services/supabase';

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
  { name: 'Strength Training', met: 5 },
  { name: 'Pilates', met: 3 },
  { name: 'Boxing', met: 9 },
  { name: 'Dance', met: 5 },
  { name: 'Other', met: 4 }
];

export const ActivityLogger: React.FC<ActivityLoggerProps> = ({ userId, userWeight, onClose, onLogSuccess }) => {
  const [selectedActivity, setSelectedActivity] = useState(ACTIVITIES[0]);
  const [duration, setDuration] = useState<number>(30);
  const [intensity, setIntensity] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [calories, setCalories] = useState<number>(0);
  const [isManualCalories, setIsManualCalories] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-calculate calories whenever inputs change
  useEffect(() => {
    if (isManualCalories) return;

    let multiplier = 1;
    if (intensity === 'Low') multiplier = 0.8;
    if (intensity === 'High') multiplier = 1.2;

    // Formula: Calories = MET * Weight(kg) * Duration(hours)
    const hours = duration / 60;
    const calculated = Math.round(selectedActivity.met * multiplier * (userWeight || 70) * hours);
    setCalories(calculated);
  }, [selectedActivity, duration, intensity, userWeight, isManualCalories]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await logActivity(userId, {
        activity_type: selectedActivity.name,
        duration_minutes: duration,
        intensity,
        calories_burned: calories,
        notes: `Logged via Activity Tracker`
      });
      onLogSuccess();
      onClose();
    } catch (e: any) {
      console.error("Failed to log activity", e);
      alert(`Failed to save activity: ${e.message || "Unknown error"}. Please check your connection.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-[#111] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-luxury-neon/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-luxury-neon/20 rounded-xl">
              <Activity className="text-luxury-neon" size={24} />
            </div>
            <h2 className="text-xl font-bold text-white font-cyber tracking-wide">Log Workout</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="text-gray-400" size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Activity Type */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Activity Type</label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto no-scrollbar">
              {ACTIVITIES.map((act) => (
                <button
                  key={act.name}
                  onClick={() => setSelectedActivity(act)}
                  className={`p-3 rounded-xl text-sm font-medium transition-all text-left ${
                    selectedActivity.name === act.name 
                      ? 'bg-luxury-neon text-black shadow-[0_0_15px_rgba(206,242,69,0.4)]' 
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {act.name}
                </button>
              ))}
            </div>
          </div>

          {/* Duration & Intensity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Clock size={12} /> Duration (min)
              </label>
              <input 
                type="number" 
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-black border border-white/10 rounded-xl p-3 text-white font-mono focus:border-luxury-neon outline-none transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Zap size={12} /> Intensity
              </label>
              <select 
                value={intensity}
                onChange={(e) => setIntensity(e.target.value as any)}
                className="w-full bg-black border border-white/10 rounded-xl p-3 text-white font-sans focus:border-luxury-neon outline-none appearance-none"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          {/* Calories Display */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-full">
                <Flame className="text-orange-500" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Est. Burn</p>
                <div className="flex items-baseline gap-1">
                  {isManualCalories ? (
                    <input 
                      type="number" 
                      value={calories}
                      onChange={(e) => setCalories(Number(e.target.value))}
                      className="bg-transparent text-2xl font-black text-white w-20 outline-none border-b border-white/20 focus:border-orange-500"
                      autoFocus
                    />
                  ) : (
                    <span className="text-2xl font-black text-white">{calories}</span>
                  )}
                  <span className="text-xs text-gray-500 font-bold">KCAL</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsManualCalories(!isManualCalories)}
              className="text-xs text-luxury-neon hover:underline"
            >
              {isManualCalories ? 'Auto-Calc' : 'Edit Manual'}
            </button>
          </div>

          {/* Submit Button */}
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-4 bg-luxury-neon text-black font-black uppercase tracking-widest rounded-xl hover:bg-[#b8d93e] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(206,242,69,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="animate-pulse">Syncing...</span>
            ) : (
              <>
                <Save size={18} /> Log Workout
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
