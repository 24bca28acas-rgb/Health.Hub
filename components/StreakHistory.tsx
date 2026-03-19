
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Flame, Loader2, Calendar, AlertCircle } from 'lucide-react';
import { fetchFullUserDashboard } from '../services/storage';
import DayDetailsModal from './DayDetailsModal';

interface StreakHistoryProps {
  userId: string;
  onClose: () => void;
}

const StreakHistory: React.FC<StreakHistoryProps> = ({ userId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<Record<string, any>>({});
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 1. STORAGE INTEGRATION (Fetch Data)
  useEffect(() => {
    const fetchHistory = async () => {
      if (!userId) return;
      setLoading(true);
      
      try {
        const dashboard = await fetchFullUserDashboard(userId);
        const data = dashboard?.history || [];

        // Convert response into local Map for the calendar grid flame logic
        const dataMap: Record<string, any> = {};
        data.forEach((row: any) => {
          dataMap[row.activityDate] = {
            steps: row.steps
          };
        });
        
        setHistoryData(dataMap);
      } catch (err) {
        console.error("Storage Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [userId]);

  // Calendar Logic
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const startDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => {
    const next = new Date(year, month + 1, 1);
    if (next <= new Date()) setCurrentDate(next);
  };

  const isFutureMonth = new Date(year, month + 1, 1) > new Date();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // 2. GRID INTERACTION
  const handleDayClick = (day: number) => {
    const dateObj = new Date(year, month, day);
    const dateStr = dateObj.toISOString().split('T')[0];

    // Simply set the date and let the Modal fetch the data
    if (dateObj > new Date()) {
       showToast("Future data unavailable");
    } else {
       setSelectedDate(dateStr);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm glass-card rounded-[2.5rem] p-6 border border-white/10 shadow-2xl relative"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-luxury-neon/20 rounded-2xl text-luxury-neon">
              <Calendar size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Streak History</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Supabase Verified</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Toast Notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="absolute top-20 left-6 right-6 z-[110] bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xl"
            >
              <AlertCircle size={14} className="text-luxury-neon" />
              {toastMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-luxury-neon" size={32} />
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Syncing Cloud Log...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Calendar Controls */}
            <div className="flex justify-between items-center px-2">
              <button onClick={prevMonth} className="p-2 text-gray-500 hover:text-white transition-colors"><ChevronLeft size={20}/></button>
              <span className="text-sm font-black text-white uppercase tracking-widest">{monthName} {year}</span>
              <button 
                onClick={nextMonth} 
                disabled={isFutureMonth}
                className={`p-2 transition-colors ${isFutureMonth ? 'text-gray-800' : 'text-gray-500 hover:text-white'}`}
              >
                <ChevronRight size={20}/>
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 text-center mb-2">
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <span key={`${d}-${i}`} className="text-[10px] font-bold text-gray-700">{d}</span>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dObj = new Date(year, month, day);
                const dStr = dObj.toISOString().split('T')[0];
                const isStreak = historyData[dStr] && historyData[dStr].steps >= 1; 
                const isToday = dStr === new Date().toISOString().split('T')[0];
                const isFuture = dObj > new Date();

                return (
                  <motion.button 
                    key={day} 
                    onClick={() => handleDayClick(day)}
                    whileTap={{ scale: 0.9 }}
                    className={`relative h-10 flex items-center justify-center rounded-full transition-all ${isFuture ? 'cursor-default' : 'cursor-pointer hover:bg-white/5'}`}
                  >
                    {isStreak ? (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-[0_0_10px_rgba(234,88,12,0.4)]">
                        <Flame size={16} className="text-white fill-white animate-pulse" />
                      </div>
                    ) : (
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${isToday ? 'bg-white/15 text-white border border-white/20' : isFuture ? 'text-gray-800' : 'text-gray-500'}`}>
                        {day}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>

      {/* 3. Day Report Modal */}
      <AnimatePresence>
        {selectedDate && (
          <DayDetailsModal date={selectedDate} userId={userId} onClose={() => setSelectedDate(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default StreakHistory;
