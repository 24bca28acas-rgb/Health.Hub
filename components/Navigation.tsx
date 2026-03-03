
import React from 'react';
import { ViewState } from '../types';
import { motion } from 'framer-motion';
import { Activity, Camera, MessageSquare, User, Navigation as NavIcon, Dumbbell } from 'lucide-react';

interface NavigationProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentView, setView }) => {
  const tabs = [
    { id: ViewState.DASHBOARD, icon: Activity, label: 'Home' },
    { id: ViewState.FOOD_LENS, icon: Camera, label: 'Lens' },
    { id: ViewState.MAP_TRACKER, icon: NavIcon, label: 'Track' },
    { id: ViewState.WORKOUT_LAB, icon: Dumbbell, label: 'Lab' },
    { id: ViewState.CHAT, icon: MessageSquare, label: 'Coach' },
    { id: ViewState.PROFILE, icon: User, label: 'Me' },
  ];

  return (
    <div className="w-full z-50 bg-black border-t border-white/10 pb-[env(safe-area-inset-bottom)] shrink-0">
      <div className="flex items-center justify-between px-2 h-[80px]">
        {tabs.map(({ id, icon: Icon, label }) => {
          const isActive = currentView === id;
          return (
            <motion.button
              key={id}
              onClick={() => setView(id)}
              whileTap={{ scale: 0.9 }}
              className="flex-1 flex flex-col items-center justify-center gap-1 h-full group transition-transform duration-200"
            >
              <motion.div 
                initial={false}
                animate={{
                  backgroundColor: isActive ? 'rgba(206, 242, 69, 1)' : 'rgba(255, 255, 255, 0)',
                  color: isActive ? '#000000' : '#4b5563',
                  scale: isActive ? 1.1 : 1,
                  boxShadow: isActive ? '0 0 20px rgba(206, 242, 69, 0.4)' : 'none'
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="relative flex items-center justify-center w-[58px] h-[32px] rounded-full"
              >
                <Icon size={isActive ? 20 : 22} strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>
              <motion.span 
                animate={{
                  color: isActive ? '#ffffff' : '#4b5563',
                  opacity: isActive ? 1 : 0.6
                }}
                className="text-[9px] font-black uppercase tracking-widest mt-0.5"
              >
                {label}
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default Navigation;
