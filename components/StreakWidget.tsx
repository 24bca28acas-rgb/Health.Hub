
import React, { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, X, ChevronRight, Calendar, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import DayDetailsModal from './DayDetailsModal';

interface StreakWidgetProps {
  completedDates: string[]; // List<DateTime> logic: YYYY-MM-DD strings
  onSeeMore?: () => void;
  userId: string | null;
}

const StreakWidget: React.FC<StreakWidgetProps> = ({ completedDates, onSeeMore, userId }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // --- STREAK CALCULATION LOGIC ---
  const streak = useMemo(() => {
    const datesSet = new Set(completedDates);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let cursor = new Date(today);
    
    if (datesSet.has(todayStr)) {
       // Cursor is already today
    } else if (datesSet.has(yesterdayStr)) {
       cursor = yesterday;
    } else {
       return 0;
    }

    let count = 0;
    while (true) {
        const key = cursor.toISOString().split('T')[0];
        if (datesSet.has(key)) {
            count++;
            cursor.setDate(cursor.getDate() - 1);
        } else {
            break;
        }
    }
    return count;
  }, [completedDates]);

  // --- WEEKLY ROW LOGIC ---
  const weekData = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const currentDay = today.getDay(); // 0-6
    
    // Calculate Monday of current week
    const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));

    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dStr = d.toISOString().split('T')[0];

        let state: 'future' | 'completed' | 'missed' | 'pending' = 'future';

        if (dStr > todayStr) {
            state = 'future'; // Grey Empty Box
        } else if (completedDates.includes(dStr)) {
            state = 'completed'; // Neon Green Flame
        } else if (dStr === todayStr) {
            state = 'pending'; // Today, not yet completed
        } else {
            state = 'missed'; // Past AND not in completedWorkouts -> Red X
        }

        days.push({
            dayLabel: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
            dateStr: dStr,
            state
        });
    }
    return days;
  }, [completedDates]);

  // Milestone Celebration
  useEffect(() => {
    if (streak > 0 && streak % 7 === 0) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#CEF245', '#FFFFFF']
      });
    }
  }, [streak]);

  const handleDayClick = (dateStr: string, state: string) => {
      if (state === 'future') return;
      setSelectedDate(dateStr);
  };

  const showToast = (msg: string) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <>
      <div className="w-full glass-card rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden border border-white/5">
        
        {/* Toast Notification */}
        <AnimatePresence>
            {toastMessage && (
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/80 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold py-2 px-4 rounded-full flex items-center gap-2 shadow-xl whitespace-nowrap"
                >
                    <AlertCircle size={12} className="text-luxury-neon" />
                    {toastMessage}
                </motion.div>
            )}
        </AnimatePresence>

        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Consistency</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">Weekly Status</p>
          </div>
          <div className="px-3 py-1 bg-white/5 rounded-full flex items-center gap-2">
            <Calendar size={10} className="text-gray-400" />
            <span className="text-[9px] font-bold text-gray-300 tracking-wider">THIS WEEK</span>
          </div>
        </div>

        <div className="grid grid-cols-7 w-full gap-2 mb-6">
          {weekData.map((data, index) => (
            <div key={`${data.dayLabel}-${index}`} className="flex flex-col items-center gap-2">
              <motion.button
                onClick={() => handleDayClick(data.dateStr, data.state)}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                whileTap={{ scale: 0.9 }}
                className={`
                  w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 relative
                  ${data.state === 'future' ? 'bg-white/5 border border-white/5 cursor-default' : 'cursor-pointer hover:border-white/30'}
                  ${data.state === 'pending' ? 'bg-white/5 border border-white/20 animate-pulse' : ''}
                  ${data.state === 'missed' ? 'bg-red-500/10 border border-red-500/20 text-red-500' : ''}
                  ${data.state === 'completed' ? 'bg-luxury-neon text-black shadow-[0_0_15px_rgba(206,242,69,0.4)]' : ''}
                `}
              >
                  {data.state === 'missed' && <X size={14} />}
                  {data.state === 'completed' && <Flame size={16} className="fill-current" />}
              </motion.button>
              <span className={`text-[9px] font-black uppercase ${data.state === 'completed' ? 'text-luxury-neon' : 'text-gray-600'}`}>
                {data.dayLabel}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-5 border-t border-white/5">
          <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${streak > 0 ? 'bg-luxury-neon/20' : 'bg-white/5'}`}>
                  <Flame size={14} className={streak > 0 ? 'text-luxury-neon' : 'text-gray-500'} />
              </div>
              <span className="text-xs font-black text-white uppercase tracking-widest">{streak} Day Streak</span>
          </div>
          <button onClick={onClose => onSeeMore && onSeeMore()} className="text-[10px] font-black uppercase text-gray-500 tracking-widest flex items-center gap-1 hover:text-white transition-colors">
              Details <ChevronRight size={12} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {selectedDate && userId && (
          <DayDetailsModal date={selectedDate} userId={userId} onClose={() => setSelectedDate(null)} />
        )}
      </AnimatePresence>
    </>
  );
};

export default StreakWidget;
