
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Flame, Footprints, ClipboardList, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { fetchDayData } from '../services/storage';

interface DayDetailsModalProps {
  date: string; // YYYY-MM-DD
  userId: string;
  onClose: () => void;
}

interface DayStats {
  steps: number;
  calories: number;
  foodLogs: { name: string; calories: number }[];
  exists: boolean;
}

const DayDetailsModal: React.FC<DayDetailsModalProps> = ({ date, userId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DayStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Format Date: "Wed, Oct 25"
  const dateObj = new Date(date);
  const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { activity, food } = await fetchDayData(userId, date);

        const steps = activity?.steps || 0;
        const calories = activity?.caloriesBurned || 0;
        const foodLogs = food.map((f: any) => ({ name: f.foodName || f.food_name, calories: f.calories })) || [];

        // Determine if record truly "exists" (has activity or food)
        const exists = !!activity || foodLogs.length > 0;

        setData({ steps, calories, foodLogs, exists });

      } catch (err: any) {
        console.error("Day Report Fetch Error:", err);
        setError("Unable to sync day records.");
      } finally {
        setLoading(false);
      }
    };

    if (userId && date) fetchData();
  }, [userId, date]);

  return (
    <div className="fixed inset-0 z-[200] flex justify-end flex-col">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ y: "100%" }} 
        animate={{ y: 0 }} 
        exit={{ y: "100%" }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative z-10 w-full bg-[#0A0A0A] border-t border-white/10 rounded-t-[2.5rem] p-6 pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]"
      >
        <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8 px-2">
          <div>
             <h2 className="text-2xl font-black text-white tracking-tight">Day Report</h2>
             <div className="flex items-center gap-2 mt-1">
                <Calendar size={12} className="text-luxury-neon" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{formattedDate}</span>
             </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-white transition-colors">
             <X size={20} />
          </button>
        </div>

        {loading ? (
           <div className="h-64 flex flex-col items-center justify-center gap-4 opacity-50">
              <Loader2 className="animate-spin text-luxury-neon" size={32} />
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Retrieving Cloud Data...</p>
           </div>
        ) : error ? (
           <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 mb-8">
              <AlertCircle size={24} className="text-red-500" />
              <p className="text-xs text-red-300 font-medium">{error}</p>
           </div>
        ) : !data?.exists && data?.steps === 0 ? (
           // EMPTY STATE
           <div className="h-48 flex flex-col items-center justify-center text-center opacity-40">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                 <Calendar size={24} className="text-gray-500" />
              </div>
              <p className="text-sm font-bold text-gray-300">System offline for this date</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">No metrics recorded</p>
           </div>
        ) : (
           // DATA STATE
           <>
                <div className="grid grid-cols-3 gap-3 mb-8">
                    <div className="glass-card p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                        <Footprints size={18} className="text-luxury-neon mb-2" />
                        <span className="text-lg font-black text-white">{data?.steps.toLocaleString()}</span>
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Steps</span>
                    </div>
                    <div className="glass-card p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                        <Flame size={18} className="text-luxury-neon mb-2" />
                        <span className="text-lg font-black text-white">{data?.calories}</span>
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Burned</span>
                    </div>
                    <div className="glass-card p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                        <ClipboardList size={18} className="text-luxury-neon mb-2" />
                        <span className="text-lg font-black text-white">{data?.foodLogs.length}</span>
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Protocols</span>
                    </div>
                </div>

                <div className="space-y-4">
                   <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Nutritional Log</h3>
                   {data && data.foodLogs.length > 0 ? (
                       <div className="space-y-2">
                          {data.foodLogs.map((food, i) => (
                              <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                                  <div className="flex items-center gap-3">
                                      <div className="w-2 h-2 rounded-full bg-luxury-neon shadow-[0_0_8px_#CEF245]" />
                                      <span className="text-sm font-bold text-white">{food.name}</span>
                                  </div>
                                  <span className="text-xs font-black text-gray-500">{food.calories} kcal</span>
                              </div>
                          ))}
                       </div>
                   ) : (
                       <div className="p-6 text-center border border-white/5 rounded-2xl border-dashed opacity-50">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">No nutritional records for this day</p>
                       </div>
                   )}
                </div>
           </>
        )}

      </motion.div>
    </div>
  );
};

export default DayDetailsModal;
