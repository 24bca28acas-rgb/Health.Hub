
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ArrowLeft, User, Ruler, Weight, Activity, Target, CheckCircle, Loader2, AlertCircle, LogOut, Sparkles, Camera, BrainCircuit } from 'lucide-react';
import { Gender, ActivityLevel, FitnessGoal, UserProfile, ActivityData } from '../types';
import { completeOnboarding, DEFAULT_AVATAR, signOut, supabase } from '../services/storage';
import GlowingButton from './GlowingButton';

interface OnboardingScreenProps {
  user: any;
  onComplete: (profile: UserProfile) => void;
}

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ user, onComplete }) => {
  const [step, setStep] = useState(0); // Start at 0 for Intro
  const [loading, setLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState(user.user_metadata?.full_name || '');
  const [gender, setGender] = useState<Gender>('Male');
  const [dob, setDob] = useState('');
  
  const [heightStr, setHeightStr] = useState('175');
  const [weightStr, setWeightStr] = useState('75');
  
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('Moderately Active');
  const [goal, setGoal] = useState<FitnessGoal>('Maintain');

  const [errors, setErrors] = useState({ height: '', weight: '' });

  const calculateAge = (dateString: string) => {
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
  };

  const validateStep2 = () => {
    const h = parseFloat(heightStr);
    const w = parseFloat(weightStr);
    let valid = true;
    const newErrors = { height: '', weight: '' };

    if (isNaN(h) || h < 50 || h > 250) {
        newErrors.height = 'Valid range: 50 - 250 cm';
        valid = false;
    }
    if (isNaN(w) || w < 20 || w > 300) {
        newErrors.weight = 'Valid range: 20 - 300 kg';
        valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleNextStep2 = () => {
      if (validateStep2()) {
          nextStep();
      }
  };

  const handleBackToLogin = async () => {
    setIsLoggingOut(true);
    try {
      // Logic: Signing out triggers onAuthStateChanged in App.tsx
      // which swaps the view to Auth component (Navigator.pushAndRemoveUntil equivalent)
      await signOut(); 
    } catch (e) {
      console.error("Logout failed", e);
      setIsLoggingOut(false);
    }
  };

  const handleSaveAndStart = async () => {
    setSubmitError(null);
    setLoading(true);

    try {
        // 1. Validation
        if (!name.trim()) throw new Error("Please enter your display name.");
        if (!dob) throw new Error("Date of birth is required for bio-calculation.");
        
        const rawHeight = parseFloat(heightStr);
        const rawWeight = parseFloat(weightStr);
        const calculatedAge = dob ? calculateAge(dob) : 25;

        if (isNaN(rawHeight) || rawHeight <= 0) throw new Error("Invalid height input.");
        if (isNaN(rawWeight) || rawWeight <= 0) throw new Error("Invalid weight input.");

        const currentUser = user;
        const userId = currentUser.id; // Correct ID for RLS

        // 3. Calculation
        let bmr = (10 * rawWeight) + (6.25 * rawHeight) - (5 * calculatedAge);
        bmr += (gender === 'Male' ? 5 : -161);

        const multipliers: Record<ActivityLevel, number> = {
            'Sedentary': 1.2,
            'Lightly Active': 1.375,
            'Moderately Active': 1.55,
            'Very Active': 1.725
        };
        const tdee = bmr * multipliers[activityLevel];

        let calorieTarget = tdee;
        if (goal === 'Weight Loss') calorieTarget -= 500;
        if (goal === 'Muscle Gain') calorieTarget += 300;

        const metrics = {
            height: rawHeight,
            weight: rawWeight,
            age: calculatedAge,
            gender,
            dob,
            activityLevel,
            fitnessGoal: goal,
            lastWeightUpdate: Date.now(),
            lastHeightUpdate: Date.now()
        };

        const avatarUrlFromMetadata = currentUser.user_metadata?.avatar_url;

        const profileData: any = {
            name: name.trim(),
            email: currentUser.email || '',
            primary_goal: goal, // Added for routing evaluation
            metrics
        };

        if (avatarUrlFromMetadata) {
            profileData.avatarUrl = avatarUrlFromMetadata;
        }

        let stepGoal = 8000;
        if (goal === 'Weight Loss') stepGoal += 2000;
        if (activityLevel === 'Very Active') stepGoal += 3000;
        if (activityLevel === 'Sedentary') stepGoal = 6000;

        const activityGoals: ActivityData = {
            steps: 0, calories: 0, distance: 0, hydration: 0, history: [],
            stepGoal: stepGoal,
            calorieGoal: Math.round(calorieTarget),
            distanceGoal: parseFloat((stepGoal * 0.000762).toFixed(1)),
            hydrationGoal: 2.5
        };

        // 4. Save to Database
        const savedProfile = await completeOnboarding(currentUser, profileData, activityGoals);
        onComplete(savedProfile);

    } catch (e: any) {
        console.error("Protocol Save Error:", e);
        
        if (e.message?.includes("JWT") || e.message?.includes("session")) {
           setSubmitError("Security token invalid. Redirecting...");
           setTimeout(async () => { await signOut(); }, 2000);
        } else {
           setSubmitError(`Save Failed: ${e.message || "Unknown Error"}`);
        }
        setLoading(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  return (
    <div className="h-screen w-full bg-black relative overflow-y-auto no-scrollbar scroll-smooth overscroll-contain">
       {/* Background Ambience */}
       <div className="fixed top-[-20%] right-[-20%] w-[80vw] h-[80vw] bg-luxury-neon/5 rounded-full blur-[100px] animate-pulse-slow pointer-events-none"></div>
       <div className="fixed bottom-[-20%] left-[-20%] w-[80vw] h-[80vw] bg-luxury-gold/5 rounded-full blur-[100px] animate-pulse-slow pointer-events-none"></div>

       <div className="relative z-10 w-full flex flex-col items-center min-h-full p-6 py-12 lg:py-20">
          
          <div className="w-full max-w-md mb-8 flex items-center justify-start shrink-0">
            <button 
              onClick={handleBackToLogin}
              disabled={isLoggingOut || loading}
              className="flex items-center gap-2 group px-4 py-2 rounded-full hover:bg-white/5 transition-all disabled:opacity-50"
            >
              <div className="p-2 bg-luxury-neon/10 rounded-full group-hover:bg-luxury-neon/20 transition-all">
                {isLoggingOut ? (
                  <Loader2 size={18} className="text-luxury-neon animate-spin" />
                ) : (
                  <ArrowLeft size={18} className="text-luxury-neon" />
                )}
              </div>
              <span className="text-[11px] font-black text-gray-500 group-hover:text-gray-300 uppercase tracking-[0.2em] transition-all">
                {isLoggingOut ? 'Disconnecting...' : 'Back to Login'}
              </span>
            </button>
          </div>

          <div className="w-full max-w-md glass-panel rounded-[3rem] p-1 border border-white/10 shadow-2xl relative overflow-hidden my-auto shrink-0 bg-black/40 backdrop-blur-3xl">
             <AnimatePresence mode="wait">
                
                {/* STEP 0: WELCOME INTRO */}
                {step === 0 && (
                    <motion.div key="step0" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="p-10 space-y-10 text-center">
                        <div className="space-y-4">
                            <motion.div 
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="w-20 h-20 bg-luxury-neon/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-luxury-neon/20 shadow-[0_0_30px_rgba(206,242,69,0.1)]"
                            >
                                <Sparkles size={40} className="text-luxury-neon" />
                            </motion.div>
                            <motion.h1 
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-3xl font-black text-white uppercase tracking-tighter leading-none"
                            >
                                Welcome to <br/><span className="text-luxury-neon">Healthy.hub</span>
                            </motion.h1>
                            <motion.p 
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em]"
                            >
                                Your Elite Performance Protocol
                            </motion.p>
                        </div>

                        <div className="grid grid-cols-1 gap-6 text-left">
                            {[
                                { icon: BrainCircuit, title: 'AI COACH', desc: 'Personalized neural fitness insights.' },
                                { icon: Camera, title: 'FOOD LENS', desc: 'Instant biometric meal analysis.' },
                                { icon: Activity, title: 'TRACKER', desc: 'Real-time performance synchronization.' }
                            ].map((feature, i) => (
                                <motion.div 
                                    key={i}
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.5 + (i * 0.1) }}
                                    className="flex items-center gap-4 group"
                                >
                                    <div className="p-3 bg-white/5 rounded-2xl border border-white/10 group-hover:border-luxury-neon/30 transition-all">
                                        <feature.icon size={18} className="text-luxury-neon" />
                                    </div>
                                    <div>
                                        <h3 className="text-[10px] font-black text-white uppercase tracking-widest">{feature.title}</h3>
                                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{feature.desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <motion.div 
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            className="pt-6"
                        >
                            <GlowingButton 
                                onClick={nextStep} 
                                className="w-full py-5"
                            >
                                Initialize Protocol <ChevronRight size={18} className="inline ml-2" />
                            </GlowingButton>
                        </motion.div>
                    </motion.div>
                )}

                {/* STEP 1: IDENTITY */}
                {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="p-8 space-y-6">
                        <div className="flex items-center gap-3 mb-4 text-luxury-neon">
                            <User size={24} />
                            <h2 className="text-xl font-black uppercase tracking-widest text-white">Identity</h2>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Display Name</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-luxury-neon transition-all" placeholder="Enter Name" />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Biological Sex (For BMR)</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Male', 'Female', 'Other'].map(g => (
                                        <button key={g} onClick={() => setGender(g as Gender)} className={`py-3 rounded-xl border text-xs font-bold transition-all ${gender === g ? 'bg-luxury-neon text-black border-luxury-neon' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Date of Birth</label>
                                <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-luxury-neon transition-all" />
                            </div>
                        </div>

                        <div className="pt-4 flex justify-between">
                            <button onClick={prevStep} className="px-6 py-4 bg-white/5 text-white font-black uppercase tracking-widest text-xs rounded-2xl flex items-center gap-2 hover:bg-white/10 transition-all">
                                <ArrowLeft size={16} /> Back
                            </button>
                            <button onClick={nextStep} disabled={!dob || !name} className="px-8 py-4 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl flex items-center gap-2 disabled:opacity-50 hover:scale-105 active:scale-95 transition-all">
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* STEP 2: METRICS */}
                {step === 2 && (
                    <motion.div key="step2" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="p-8 space-y-8">
                        <div className="flex items-center gap-3 mb-4 text-luxury-neon">
                            <Activity size={24} />
                            <h2 className="text-xl font-black uppercase tracking-widest text-white">Metrics</h2>
                        </div>

                        <div className="space-y-8">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">
                                    <Ruler size={14} className="text-luxury-neon" /> Height
                                </label>
                                <div className={`relative flex items-center bg-white/5 border rounded-3xl h-24 overflow-hidden transition-all duration-300 focus-within:shadow-[0_0_20px_rgba(206,242,69,0.15)] ${errors.height ? 'border-red-500 focus-within:border-red-500' : 'border-white/10 focus-within:border-luxury-neon'}`}>
                                    <input 
                                        type="number" 
                                        inputMode="decimal"
                                        value={heightStr}
                                        onChange={(e) => {
                                            setHeightStr(e.target.value);
                                            setErrors(prev => ({ ...prev, height: '' }));
                                        }}
                                        className="w-full h-full bg-transparent text-center text-4xl font-black text-white outline-none placeholder-gray-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none z-10 relative pl-4"
                                        placeholder="0"
                                    />
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <span className="text-xs font-black text-gray-500 uppercase tracking-widest">CM</span>
                                    </div>
                                </div>
                                {errors.height && (
                                    <div className="flex items-center gap-2 text-red-400 text-xs font-bold animate-pulse px-2">
                                        <AlertCircle size={12} /> {errors.height}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">
                                    <Weight size={14} className="text-luxury-gold" /> Weight
                                </label>
                                <div className={`relative flex items-center bg-white/5 border rounded-3xl h-24 overflow-hidden transition-all duration-300 focus-within:shadow-[0_0_20px_rgba(245,158,11,0.15)] ${errors.weight ? 'border-red-500 focus-within:border-red-500' : 'border-white/10 focus-within:border-luxury-gold'}`}>
                                    <input 
                                        type="number" 
                                        inputMode="decimal"
                                        value={weightStr}
                                        onChange={(e) => {
                                            setWeightStr(e.target.value);
                                            setErrors(prev => ({ ...prev, weight: '' }));
                                        }}
                                        className="w-full h-full bg-transparent text-center text-4xl font-black text-white outline-none placeholder-gray-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none z-10 relative pl-4"
                                        placeholder="0"
                                    />
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <span className="text-xs font-black text-gray-500 uppercase tracking-widest">KG</span>
                                    </div>
                                </div>
                                {errors.weight && (
                                    <div className="flex items-center gap-2 text-red-400 text-xs font-bold animate-pulse px-2">
                                        <AlertCircle size={12} /> {errors.weight}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-4 flex justify-between">
                             <button onClick={prevStep} className="px-6 py-4 bg-white/5 text-white font-black uppercase tracking-widest text-xs rounded-2xl flex items-center gap-2 hover:bg-white/10 transition-all">
                                <ArrowLeft size={16} /> Back
                            </button>
                            <button onClick={handleNextStep2} className="px-8 py-4 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* STEP 3: MISSION */}
                {step === 3 && (
                    <motion.div key="step3" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="p-8 space-y-8">
                        <div className="flex items-center gap-3 mb-2 text-luxury-neon">
                            <Target size={24} />
                            <h2 className="text-xl font-black uppercase tracking-widest text-white">Mission</h2>
                        </div>

                        <div className="space-y-8">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-4">Activity Level</label>
                                <div className="space-y-3">
                                    {['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'].map(lvl => (
                                        <button key={lvl} onClick={() => setActivityLevel(lvl as ActivityLevel)} className={`w-full p-5 rounded-2xl border text-left flex justify-between items-center transition-all ${activityLevel === lvl ? 'bg-luxury-neon/20 border-luxury-neon text-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                                            <span className="text-xs font-black uppercase tracking-wider">{lvl}</span>
                                            {activityLevel === lvl && <CheckCircle size={18} className="text-luxury-neon"/>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-4">Primary Goal</label>
                                <div className="grid grid-cols-1 gap-3">
                                    {['Weight Loss', 'Maintain', 'Muscle Gain'].map(g => (
                                        <button key={g} onClick={() => setGoal(g as FitnessGoal)} className={`w-full p-5 rounded-2xl border text-left flex justify-between items-center transition-all ${goal === g ? 'bg-white/10 border-white/30 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                                            <span className="text-xs font-black uppercase tracking-wider">{g}</span>
                                            {goal === g && <div className="w-2 h-2 rounded-full bg-luxury-neon shadow-[0_0_8px_#CEF245]" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {submitError && (
                            <motion.div 
                                initial={{ opacity: 0, y: -10 }} 
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-start gap-3 mt-4"
                            >
                                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                                <p className="text-red-400 text-xs font-bold leading-relaxed">{submitError}</p>
                            </motion.div>
                        )}

                        <div className="pt-6 flex justify-between">
                             <button onClick={prevStep} disabled={loading} className="px-6 py-4 bg-white/5 text-white font-black uppercase tracking-widest text-xs rounded-2xl flex items-center gap-2 hover:bg-white/10 transition-all">
                                <ArrowLeft size={16} /> Back
                            </button>
                            <button onClick={handleSaveAndStart} disabled={loading} className="px-8 py-4 bg-luxury-neon text-black font-black uppercase tracking-widest text-xs rounded-2xl flex items-center gap-2 shadow-[0_0_20px_rgba(206,242,69,0.4)] hover:scale-105 active:scale-95 transition-all">
                                {loading ? <Loader2 className="animate-spin" size={16}/> : <>Finish Protocol <ChevronRight size={16} /></>}
                            </button>
                        </div>
                    </motion.div>
                )}
             </AnimatePresence>
          </div>
          
          <div className="h-10 w-full shrink-0" />
       </div>
    </div>
  );
};

export default OnboardingScreen;
