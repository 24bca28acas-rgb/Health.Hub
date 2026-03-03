import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserMetrics } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';

const BMIHub: React.FC = () => {
  const [metrics, setMetrics] = useLocalStorage<UserMetrics>('bmi_metrics', { height: 175, weight: 70 });
  const [bmi, setBmi] = useState<number>(0);
  const [status, setStatus] = useState<string>('');
  const [idealRange, setIdealRange] = useState<string>('');
  
  useEffect(() => {
    const h = metrics.height / 100; // convert cm to meters
    if (h <= 0) return;

    const w = metrics.weight;
    const val = w / (h * h);
    setBmi(Number(val.toFixed(1)));

    // Clinical Categories
    if (val < 18.5) setStatus('Underweight');
    else if (val < 25) setStatus('Normal Weight');
    else if (val < 30) setStatus('Overweight');
    else setStatus('Obese');

    // Ideal Weight Range Calculation (BMI 18.5 - 24.9)
    const minW = (18.5 * h * h).toFixed(1);
    const maxW = (24.9 * h * h).toFixed(1);
    setIdealRange(`${minW} - ${maxW} kg`);

  }, [metrics]);

  const getColor = () => {
     switch (status) {
      case 'Underweight': return '#60a5fa'; // Blue
      case 'Normal Weight': return '#CEF245'; // Neon Green
      case 'Overweight': return '#f59e0b'; // Orange
      case 'Obese': return '#ef4444';      // Red
      default: return '#fff';
     }
  };

  const color = getColor();

  const getGradient = () => {
     switch (status) {
      case 'Underweight': return 'radial-gradient(circle at 50% 20%, rgba(96, 165, 250, 0.15) 0%, rgba(0,0,0,0) 60%)';
      case 'Normal Weight': return 'radial-gradient(circle at 50% 20%, rgba(206, 242, 69, 0.15) 0%, rgba(0,0,0,0) 60%)';
      case 'Overweight': return 'radial-gradient(circle at 50% 20%, rgba(245, 158, 11, 0.15) 0%, rgba(0,0,0,0) 60%)';
      case 'Obese': return 'radial-gradient(circle at 50% 20%, rgba(239, 68, 68, 0.15) 0%, rgba(0,0,0,0) 60%)';
      default: return 'none';
     }
  };

  const handleMetricChange = (key: keyof UserMetrics, val: string) => {
    if (val === '') {
        setMetrics(prev => ({ ...prev, [key]: 0 }));
        return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
        setMetrics(prev => ({ ...prev, [key]: num }));
    }
  };

  return (
     <motion.div 
      className="h-full w-full bg-black relative overflow-y-auto no-scrollbar overscroll-y-contain flex flex-col"
      style={{ WebkitOverflowScrolling: 'touch' }}
      animate={{ backgroundImage: getGradient() }}
    >
      {/* Main Content Column (Equivalent to Flutter's Column in a SingleChildScrollView) */}
      <div className="flex flex-col items-center p-8 pb-20 gap-8 relative z-10 w-full">
        
        {/* Header Widget */}
        <div className="pt-8 text-center shrink-0">
          <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.5em] mb-2">Biometric Analysis</h2>
          <h1 className="text-3xl font-black text-white leading-none tracking-tight">BIO<span className="text-luxury-neon">SCAN</span></h1>
        </div>

        {/* 1. Digital Result Display Card */}
        <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-card w-full max-w-sm rounded-[3rem] p-10 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl border border-white/5 shrink-0"
        >
             <div className="absolute inset-0 opacity-20 transition-colors duration-1000" style={{ background: `radial-gradient(circle at center, ${color}, transparent 70%)` }}></div>
             
             <motion.span 
                key={bmi} 
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="text-[5.5rem] leading-none font-black tracking-tighter relative z-10"
                style={{ 
                    color: color,
                    textShadow: `0 0 40px ${color}66`
                }}
             >
                {bmi}
             </motion.span>
             
             <motion.div 
                key={status}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 px-5 py-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-md relative z-10"
             >
                <span className="text-sm font-black text-white uppercase tracking-[0.3em]">{status}</span>
             </motion.div>
        </motion.div>

        {/* 2. Calibration Inputs Group */}
        <div className="w-full max-w-sm grid grid-cols-2 gap-4 shrink-0">
             <div className="group">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 block pl-2 group-focus-within:text-luxury-neon transition-colors">Height</label>
                <div className="relative flex items-center bg-white/5 border border-white/10 rounded-3xl focus-within:border-luxury-neon focus-within:bg-white/10 focus-within:shadow-[0_0_15px_rgba(206,242,69,0.2)] transition-all duration-300 h-24 overflow-hidden">
                    <input 
                        type="number" 
                        value={metrics.height || ''}
                        onChange={(e) => handleMetricChange('height', e.target.value)}
                        className="w-full h-full bg-transparent text-center text-4xl font-black text-white outline-none placeholder-gray-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none z-10 relative"
                        placeholder="0"
                    />
                    <span className="absolute bottom-4 w-full text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest pointer-events-none">CM</span>
                </div>
            </div>

            <div className="group">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 block pl-2 group-focus-within:text-luxury-neon transition-colors">Weight</label>
                <div className="relative flex items-center bg-white/5 border border-white/10 rounded-3xl focus-within:border-luxury-neon focus-within:bg-white/10 focus-within:shadow-[0_0_15px_rgba(206,242,69,0.2)] transition-all duration-300 h-24 overflow-hidden">
                    <input 
                        type="number" 
                        value={metrics.weight || ''}
                        onChange={(e) => handleMetricChange('weight', e.target.value)}
                        className="w-full h-full bg-transparent text-center text-4xl font-black text-white outline-none placeholder-gray-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none z-10 relative"
                        placeholder="0"
                    />
                    <span className="absolute bottom-4 w-full text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest pointer-events-none">KG</span>
                </div>
            </div>
        </div>

        {/* 3. Estimated Optimal Mass Summary */}
        <div className="w-full max-w-sm text-center space-y-3 bg-white/5 p-6 rounded-3xl border border-white/5 shrink-0">
             <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Estimated Optimal Mass</p>
             <p className="text-2xl font-black text-white tracking-tight">{idealRange}</p>
             <div className="h-px w-12 bg-white/10 mx-auto my-1"></div>
             <p className="text-[9px] text-gray-500 max-w-[200px] mx-auto leading-relaxed">
                Calculated based on standard clinical thresholds for <span className="text-white">{metrics.height}cm</span>.
             </p>
        </div>

        {/* 4. Safety Padding (Equivalent to SizedBox(height: 20)) */}
        <div className="h-5 shrink-0" />

      </div>
    </motion.div>
  );
};

export default BMIHub;