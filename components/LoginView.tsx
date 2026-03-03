import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfile } from '../types';
import { DEFAULT_AVATAR } from '../services/supabase';
import Logo from './Logo';

interface LoginViewProps {
  onLogin: (user: UserProfile) => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleLogin = () => {
    setStatus('loading');
    
    // Simulate API delay
    setTimeout(() => {
      setStatus('success');
      // Simulate success animation delay before transition
      setTimeout(() => {
         onLogin({
           name: 'Alex',
           email: 'alex.fit@example.com',
           avatarUrl: DEFAULT_AVATAR
         });
      }, 2000);
    }, 1500);
  };

  return (
    <div className="h-screen w-full relative flex items-center justify-center overflow-hidden bg-black">
      {/* Background Ambience */}
      <div className="absolute top-[-20%] left-[-20%] w-[80vw] h-[80vw] bg-luxury-neon/5 rounded-full blur-[120px] animate-blob"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[80vw] h-[80vw] bg-luxury-gold/5 rounded-full blur-[120px] animate-blob animation-delay-2000"></div>

      <div className="z-10 flex flex-col items-center">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.8 }}
           className="mb-12 text-center flex flex-col items-center"
        >
           {/* Logo with height 120px */}
           <Logo className="h-[120px] w-auto mb-4" />
           <h1 className="text-4xl font-bold tracking-tighter mb-2">Healthy<span className="text-luxury-neon">.hub</span></h1>
           <p className="text-gray-400 text-sm tracking-widest uppercase">The Ultimate Luxury Companion</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.button
              key="login-btn"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
              whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(163, 230, 53, 0.3)" }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogin}
              className="group relative px-8 py-4 rounded-full bg-white text-black font-bold flex items-center gap-3 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="G" />
              <span>Continue with Google</span>
            </motion.button>
          )}

          {status === 'loading' && (
            <motion.div
              key="loader"
              initial={{ opacity: 0, scale: 0.5, rotate: 0 }}
              animate={{ opacity: 1, scale: 1, rotate: 360 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.5 }}
              className="w-12 h-12 rounded-full border-4 border-white/20 border-t-luxury-neon"
            />
          )}

          {status === 'success' && (
             <motion.div
               key="avatar"
               initial={{ opacity: 0, scale: 0.5 }}
               animate={{ opacity: 1, scale: 1 }}
               className="relative"
             >
                <motion.img 
                  src={DEFAULT_AVATAR}
                  className="w-24 h-24 rounded-full border-4 border-luxury-neon shadow-[0_0_30px_rgba(163,230,53,0.6)]"
                  alt="User"
                  layoutId="user-avatar"
                />
                <motion.div 
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: 0.3 }}
                   className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap"
                >
                   <p className="text-white font-bold text-lg">Welcome back, Alex</p>
                </motion.div>
             </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LoginView;