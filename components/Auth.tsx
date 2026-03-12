
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  createUserDocument, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail,
  signInAsGuest,
  signOut,
  User
} from '../services/supabase'; 
import { Loader2, Eye, EyeOff, AlertCircle, User as UserIcon, Mail, Lock, CheckCircle, Camera, RefreshCw, ChevronRight, UserCircle2, Check, ArrowRight, Clock, DatabaseZap, UserPlus, ShieldAlert } from 'lucide-react';
import Logo from './Logo';

interface AuthProps {
  onLoginSuccess: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [quotaError, setQuotaError] = useState(false);
  const [isCredentialError, setIsCredentialError] = useState(false);
  
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [rememberMe, setRememberMe] = useState(false);

  const [showCamera, setShowCamera] = useState(false);
  const [tempUser, setTempUser] = useState<User | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const savedEmail = localStorage.getItem('healthy_hub_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    let interval: number;
    if (lockoutTimer > 0) {
      interval = window.setInterval(() => {
        setLockoutTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const nuclearReset = async () => {
    try {
      await signOut();
    } catch (e) {
      console.warn("Sign out failed during nuclear reset, proceeding with wipe.");
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 500 }, height: { ideal: 500 } }
      });
      setStream(mediaStream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(e => console.error("Video play failed", e));
        }
      }, 100);
    } catch (err) {
      setError("Camera access denied.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const size = Math.min(video.videoWidth, video.videoHeight);
      
      // Resize to 200x200 to prevent massive base64 strings
      const TARGET_SIZE = 200;
      canvas.width = TARGET_SIZE;
      canvas.height = TARGET_SIZE;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const startX = (video.videoWidth - size) / 2;
        const startY = (video.videoHeight - size) / 2;
        ctx.drawImage(video, startX, startY, size, size, 0, 0, TARGET_SIZE, TARGET_SIZE);
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        setCapturedImage(base64);
        stopCamera();
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleSaveAvatar = async () => {
    if (!capturedImage || !tempUser) return;
    setIsLoading(true);
    try {
      await updateProfile(tempUser, { photoURL: capturedImage });
      // Add a small delay to ensure web local storage syncs
      await new Promise(resolve => setTimeout(resolve, 500));
      onLoginSuccess();
    } catch (e) {
      setError("Failed to save avatar.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipAvatar = async () => {
    stopCamera();
    // Add a small delay to ensure web local storage syncs
    await new Promise(resolve => setTimeout(resolve, 500));
    onLoginSuccess();
  };

  const handleGuestMode = () => {
    setIsLoading(true);
    signInAsGuest();
  };

  const handleResetPassword = async () => {
    if (!resetEmail) {
      setResetError("Email required.");
      return;
    }
    setIsLoading(true);
    setResetError(null);
    try {
      await sendPasswordResetEmail(resetEmail);
      setSuccessMsg("Reset instructions dispatched.");
      setTimeout(() => {
        setIsResetModalOpen(false);
        setSuccessMsg(null);
        setResetEmail('');
      }, 2500);
    } catch (err: any) {
      const msg = err.message || "Reset failed.";
      if (msg.toLowerCase().includes("failed to fetch")) {
        setResetError("Network Error: Connection blocked. Please check your connection or adblocker.");
      } else {
        setResetError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTimer > 0) return;
    
    setError(null);
    setQuotaError(false);
    setIsCredentialError(false);
    setIsLoading(true);

    const performAuth = async () => {
      if (isLogin) {
        await signInWithEmailAndPassword(email, password);
        if (rememberMe) {
          try { localStorage.setItem('healthy_hub_remembered_email', email); } catch (e) {}
        } else {
          try { localStorage.removeItem('healthy_hub_remembered_email'); } catch (e) {}
        }
        // Add a small delay to ensure web local storage syncs
        await new Promise(resolve => setTimeout(resolve, 500));
        onLoginSuccess();
      } else {
        if (!password || !confirmPassword) throw new Error("Password fields required.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");
        const { data } = await createUserWithEmailAndPassword(email, password);
        if (rememberMe) {
          try { localStorage.setItem('healthy_hub_remembered_email', email); } catch (e) {}
        } else {
          try { localStorage.removeItem('healthy_hub_remembered_email'); } catch (e) {}
        }
        const user = data.user;
        if (user) {
            if (name) {
                await updateProfile(user, { displayName: name });
                await createUserDocument(user, name);
            } else {
                await createUserDocument(user, 'Elite User');
            }
            setTempUser(user);
            setShowCamera(true);
            startCamera();
        }
      }
    };

    try {
      await performAuth();
    } catch (err: any) {
      const errorMessage = typeof err === 'string' ? err : (err.message || "");
      const isQuotaError = errorMessage.toLowerCase().includes('quota') || err.name === 'QuotaExceededError';
      const isExpectedAuthError = errorMessage.toLowerCase().includes('invalid login credentials') || 
                                  errorMessage.toLowerCase().includes('rate limit') ||
                                  errorMessage.toLowerCase().includes('too many requests') ||
                                  errorMessage === "Passwords do not match." ||
                                  errorMessage.includes("at least 6 characters") ||
                                  errorMessage.toLowerCase().includes("already registered") ||
                                  errorMessage.toLowerCase().includes("account corrupted") ||
                                  errorMessage.toLowerCase().includes("failed to fetch");
      
      if (!isQuotaError && !isExpectedAuthError) {
        console.error('❌ AUTH ERROR:', errorMessage || err);
      }
      
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

      if (isQuotaError) {
        setQuotaError(true);
        localStorage.clear();
        try {
          await performAuth();
          setQuotaError(false);
          return;
        } catch (retryErr: any) {
          setError("Storage full. Clear browser data.");
          setIsLoading(false);
          return;
        }
      }

      let msg = errorMessage || "Auth Protocol Refused.";
      const lowerMsg = msg.toLowerCase();
      
      if (lowerMsg.includes("invalid login credentials")) {
        msg = "Credentials not recognized. Please switch to 'Sign Up' if this is your first time.";
        setIsCredentialError(true);
      } else if (lowerMsg.includes("rate limit") || lowerMsg.includes("too many requests")) {
        msg = "Neural network throttled. Wait 60s.";
        setLockoutTimer(60);
      } else if (lowerMsg.includes("account corrupted")) {
        msg = errorMessage;
      } else if (lowerMsg.includes("failed to fetch")) {
        msg = "Network Error: Connection blocked (check adblockers/firewall). Use Guest Protocol to proceed offline.";
      } else if (lowerMsg.includes("user already registered")) {
        msg = "ID already exists. Please switch to 'Login' mode.";
      }
      
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-black font-sans relative overflow-y-auto no-scrollbar scroll-smooth pb-[env(safe-area-inset-bottom)]">
      {/* 1. Background & Atmosphere: Deep Radial Gradient */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_center,_#1a1a1a_0%,_#000000_100%)] pointer-events-none" />
      
      {/* Subtle Mesh/Grid Pattern */}
      <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] pointer-events-none"></div>

      <AnimatePresence>
        {showCamera && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6"
          >
             <div className="w-full max-w-md flex flex-col items-center space-y-8">
                <div className="text-center">
                   <h2 className="text-2xl font-black text-white uppercase tracking-widest font-cyber mb-2">Bio-Identity</h2>
                   <p className="text-gray-400 text-xs tracking-wider">Capture profile avatar for the elite network.</p>
                </div>
                <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-luxury-neon shadow-[0_0_40px_rgba(206,242,69,0.3)] bg-gray-900">
                    {capturedImage ? (
                        <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
                    ) : (
                        <>
                           <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror-mode" />
                           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              {!stream && <Loader2 className="animate-spin text-luxury-neon" />}
                           </div>
                        </>
                    )}
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-4 w-full max-w-xs">
                   {capturedImage ? (
                      <>
                        <button onClick={handleRetake} className="flex-1 py-4 bg-white/10 rounded-2xl text-white font-bold flex items-center justify-center gap-2 border border-white/10 hover:bg-white/20 transition-all">
                           <RefreshCw size={18} /> Retake
                        </button>
                        <button onClick={handleSaveAvatar} disabled={isLoading} className="flex-1 py-4 bg-luxury-neon rounded-2xl text-black font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(206,242,69,0.4)]">
                           {isLoading ? <Loader2 className="animate-spin" /> : <><CheckCircle size={18} /> Save</>}
                        </button>
                      </>
                   ) : (
                      <button onClick={capturePhoto} className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-xl hover:scale-105 transition-transform">
                          <Camera size={20} /> Capture
                      </button>
                   )}
                </div>
                <button onClick={handleSkipAvatar} className="text-gray-500 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">
                   Skip Initialization <ChevronRight size={10} className="inline" />
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showCamera && (
        <div className="relative z-10 min-h-[100dvh] w-full flex flex-col items-center p-6 pt-12 pb-10 lg:pt-20">
          
          {/* 2. The Login Card (Glassmorphism) */}
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-white/5 backdrop-blur-xl rounded-[24px] p-8 md:p-12 border border-white/10 shadow-2xl relative overflow-hidden"
            >
              {/* Ambient Glow inside card */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-luxury-neon/5 blur-[60px] pointer-events-none"></div>

              <div className="flex flex-col items-center mb-10 text-center relative z-10">
                <Logo className="h-[100px] w-auto mb-6 drop-shadow-[0_0_25px_rgba(206,242,69,0.2)]" />
                {/* 5. Typography: Modern, wide font */}
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.5em] leading-relaxed font-cyber">Elite Fitness Ecosystem</p>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0, scale: 0.95 }} 
                    animate={{ height: 'auto', opacity: 1, scale: 1 }} 
                    exit={{ height: 0, opacity: 0, scale: 0.95 }}
                    className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-6 flex flex-col gap-2 text-red-400 shadow-lg overflow-hidden relative z-10"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold font-cyber">
                      {isCredentialError ? <ShieldAlert size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />} 
                      <span className="flex-1 uppercase tracking-widest">{isCredentialError ? "Access Denied" : "System Error"}</span>
                    </div>
                    <p className="text-[10px] leading-relaxed text-red-300/80 italic pl-6 font-medium">
                      {error}
                    </p>
                    
                    <div className="pl-6 flex flex-wrap gap-2 mt-2">
                      {isCredentialError && isLogin && (
                          <button 
                              onClick={() => { setIsLogin(false); setError(null); setIsCredentialError(false); }}
                              className="py-2 px-4 bg-luxury-neon text-black rounded-lg text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-[0_0_10px_rgba(206,242,69,0.2)]"
                          >
                              <UserPlus size={12} /> Register ID
                          </button>
                      )}
                      <button 
                          onClick={nuclearReset}
                          className="py-2 px-4 bg-white/5 border border-white/10 text-gray-400 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white/10"
                      >
                          <RefreshCw size={12} /> Force Reset
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleAuth} className="space-y-5 relative z-10">
                {/* 3. Premium Input Fields */}
                {!isLogin && (
                   <div className="relative group">
                      <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-luxury-neon transition-colors" />
                      <input 
                        type="text" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        placeholder="Display Name"
                        className="w-full pl-12 pr-4 py-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl text-white text-sm font-medium placeholder:text-gray-500 outline-none focus:border-luxury-neon/30 transition-all" 
                      />
                   </div>
                )}
                <div className="relative group">
                   <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-luxury-neon transition-colors" />
                   <input 
                     type="email" 
                     value={email} 
                     onChange={(e) => setEmail(e.target.value)} 
                     placeholder="Elite Email"
                     className="w-full pl-12 pr-4 py-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl text-white text-sm font-medium placeholder:text-gray-500 outline-none focus:border-luxury-neon/30 transition-all" 
                   />
                </div>
                <div className="relative group">
                   <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-luxury-neon transition-colors" />
                   <input 
                     type={showPassword ? "text" : "password"} 
                     value={password} 
                     onChange={(e) => setPassword(e.target.value)} 
                     placeholder="Passcode"
                     className="w-full pl-12 pr-12 py-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl text-white text-sm font-medium placeholder:text-gray-500 outline-none focus:border-luxury-neon/30 transition-all" 
                   />
                   <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                   </button>
                </div>

                {!isLogin && (
                   <div className="relative group">
                      <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-luxury-neon transition-colors" />
                      <input 
                        type={showPassword ? "text" : "password"} 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        placeholder="Confirm Passcode"
                        className="w-full pl-12 pr-12 py-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl text-white text-sm font-medium placeholder:text-gray-500 outline-none focus:border-luxury-neon/30 transition-all" 
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                         {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                   </div>
                )}

                {/* Remember Me & Recovery Links */}
                <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setRememberMe(!rememberMe)}>
                       <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${rememberMe ? 'bg-luxury-neon border-luxury-neon shadow-[0_0_10px_rgba(206,242,69,0.4)]' : 'border-white/20 bg-transparent group-hover:border-white/50'}`}>
                          {rememberMe && <Check size={10} className="text-black" />} 
                       </div>
                       <span className="text-[12px] font-medium text-gray-400 uppercase tracking-wider select-none group-hover:text-gray-300 transition-colors">Sync ID</span>
                    </div>
                    
                    {isLogin && (
                       <button type="button" onClick={() => setIsResetModalOpen(true)} className="text-[12px] font-medium text-gray-400 uppercase tracking-wider hover:text-luxury-neon transition-opacity hover:opacity-80 active:opacity-60">
                          Recover Key
                       </button>
                    )}
                </div>
                
                {/* 4. The 'Hero' Button */}
                <button 
                  disabled={isLoading || lockoutTimer > 0} 
                  className="w-full py-5 bg-luxury-neon text-black/80 font-bold uppercase tracking-[1.5px] text-xs rounded-2xl shadow-[0_0_20px_2px_rgba(206,242,69,0.3)] hover:shadow-[0_0_30px_4px_rgba(206,242,69,0.4)] disabled:opacity-50 mt-6 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 border border-luxury-neon/20 font-cyber"
                >
                   {isLoading ? (
                      <Loader2 className="animate-spin" size={18} />
                   ) : (
                      isLogin ? "Initialize Session" : "Join Network"
                   )}
                </button>
              </form>
            </motion.div>
          </div>

          <div className="w-full max-w-md mx-auto mt-8 flex flex-col gap-4 pb-12 relative z-10">
             <button 
                onClick={handleGuestMode}
                disabled={isLoading || lockoutTimer > 0}
                className="w-full py-4 bg-white/5 border border-white/30 text-gray-400 font-bold uppercase tracking-widest text-[10px] rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
             >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <><UserCircle2 size={16} /> Guest Protocol</>}
             </button>

             <div className="text-center">
                <button onClick={() => { setIsLogin(!isLogin); setError(null); setIsCredentialError(false); }} className="text-[11px] font-bold text-gray-500 hover:text-white transition-colors tracking-wide">
                   {isLogin ? "New User?" : "Have an ID?"} <span className="text-luxury-neon ml-1 uppercase">Switch Mode</span>
                </button>
             </div>

             {/* Bottom Buffer for Scrollability & System Bar Clearance */}
             <div className="h-[50px] w-full" />
          </div>
        </div>
      )}
      
      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsResetModalOpen(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm bg-white/5 backdrop-blur-xl p-8 rounded-[24px] border border-white/10 shadow-2xl">
               <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 font-cyber">Reset Access</h2>
               <p className="text-xs text-gray-400 mb-6 leading-relaxed">Enter registered email for recovery protocol.</p>
               
               <AnimatePresence>
                  {resetError && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-4 text-red-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 px-1">
                       <AlertCircle size={12} /> {resetError}
                    </motion.div>
                  )}
                  {successMsg && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-4 text-luxury-neon text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 px-1">
                       <Check size={12} /> {successMsg}
                    </motion.div>
                  )}
               </AnimatePresence>

               <div className="relative group mb-4">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <input 
                      type="email" 
                      value={resetEmail} 
                      onChange={(e) => setResetEmail(e.target.value)} 
                      placeholder="Recovery Email" 
                      className="w-full pl-10 pr-4 py-4 bg-black/30 border border-transparent rounded-2xl text-white outline-none focus:border-luxury-neon focus:shadow-[0_0_15px_rgba(206,242,69,0.3)] transition-all text-sm" 
                  />
               </div>

               <button 
                onClick={handleResetPassword} 
                disabled={isLoading}
                className="w-full py-4 bg-white text-black font-black uppercase text-xs tracking-widest rounded-2xl hover:bg-gray-200 transition-colors disabled:opacity-50 font-cyber"
               >
                {isLoading ? <Loader2 className="animate-spin mx-auto" size={16} /> : "Dispatch Link"}
               </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Auth;
