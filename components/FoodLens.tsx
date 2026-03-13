
import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, History, Loader2, BrainCircuit, Zap, X, RefreshCw, AlertCircle, CheckCircle, Edit2, Camera, Image as ImageIcon, ThumbsUp, Keyboard, ZapOff, Flashlight, Minus, Plus, ChevronDown } from 'lucide-react';
import { analyzeFoodImage, analyzeFoodText } from '../services/geminiService';
import { submitAiFeedback } from '../services/supabase';
import { FoodAnalysis, FoodHistoryItem, FoodMacro } from '../types';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

interface FoodLensProps {
  history: FoodHistoryItem[];
  onAddToHistory: (item: FoodHistoryItem) => void;
}

const FoodLens: React.FC<FoodLensProps> = ({ history, onAddToHistory }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const [inputType, setInputType] = useState<'camera' | 'text'>('camera');
  const [textInput, setTextInput] = useState('');
  
  const [analyzing, setAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [result, setResult] = useState<FoodAnalysis | null>(null);
  
  // --- DYNAMIC PORTION STATE ---
  const [baseMacros, setBaseMacros] = useState<FoodMacro | null>(null);
  const [quantity, setQuantity] = useState<number>(1.0);
  const [unit, setUnit] = useState<string>('Serving');
  
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [manualName, setManualName] = useState('');
  
  const scanLineControls = useAnimation();

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setStream(mediaStream);
      setCapturedImage(null);
      setResult(null);
      setBaseMacros(null);
      setError(null);
    } catch (err) {
      if (inputType === 'camera') {
        setError("AI Vision requires camera access.");
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  const toggleFlash = () => {
    if (stream) {
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any; // Cast to any for torch support check
      if (capabilities.torch) {
        track.applyConstraints({
          advanced: [{ torch: !flashOn }] as any
        }).then(() => setFlashOn(!flashOn));
      } else {
        // Visual feedback only if torch not supported
        setFlashOn(!flashOn); 
      }
    }
  };

  useEffect(() => {
    if (!showHistory && inputType === 'camera') {
        startCamera();
    } else {
        stopCamera();
    }
    return () => stopCamera();
  }, [showHistory, inputType]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error(e));
    }
  }, [stream]);

  // Scanning Animation Loop
  useEffect(() => {
    if (!capturedImage && !showHistory && inputType === 'camera') {
      scanLineControls.start({
        top: ["5%", "95%"],
        opacity: [0, 1, 0],
        transition: { duration: 2, repeat: Infinity, ease: "linear" }
      });
    } else {
      scanLineControls.stop();
    }
  }, [capturedImage, showHistory, inputType, scanLineControls]);

  const captureAndAnalyze = async (userHint?: string) => {
    if (!videoRef.current || !canvasRef.current || analyzing) return;
    
    if (!userHint && !capturedImage) {
        if (navigator.vibrate) navigator.vibrate(50);
        
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.85);
            setCapturedImage(base64); 
            performAnalysis(base64);
        }
    } else if (capturedImage) {
        performAnalysis(capturedImage, userHint);
    }
  };

  const performAnalysis = async (base64: string, hint?: string) => {
    setAnalyzing(true);
    setError(null);
    const incorrectPrediction = result?.name;

    try {
        const data = await analyzeFoodImage(base64, hint);
        setResult(data);
        setBaseMacros(data.macros); // Store base values (per 1 serving/unit)
        setQuantity(1.0); // Reset quantity
        setIsEditingName(false);
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        if (hint && incorrectPrediction) {
            submitAiFeedback(base64, incorrectPrediction, hint);
        }
    } catch (err) {
        setError("Analysis Failure. Unable to identify food.");
        setTimeout(() => { if (!hint) handleRetake(); else setAnalyzing(false); }, 3000);
    } finally {
        setAnalyzing(false);
    }
  };

  const handleGalleryClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setCapturedImage(base64);
        performAnalysis(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const performTextAnalysis = async () => {
    if (!textInput.trim()) return;
    setAnalyzing(true);
    setError(null);
    try {
        const data = await analyzeFoodText(textInput);
        setResult(data);
        setBaseMacros(data.macros);
        setQuantity(1.0);
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    } catch (err) {
        setError("Analysis Failed. Try a different description.");
    } finally {
        setAnalyzing(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setResult(null);
    setBaseMacros(null);
    setAnalyzing(false);
    setError(null);
    setIsEditingName(false);
    setManualName('');
    if (inputType === 'camera' && !stream) startCamera();
  };

  // --- DYNAMIC CALCULATION LOGIC ---
  const currentMacros = baseMacros ? {
      calories: Math.round(baseMacros.calories * quantity),
      protein: Math.round(baseMacros.protein * quantity),
      fat: Math.round(baseMacros.fat * quantity),
      carbs: Math.round(baseMacros.carbs * quantity),
  } : { calories: 0, protein: 0, fat: 0, carbs: 0 };

  const adjustQuantity = (delta: number) => {
      setQuantity(prev => {
          const next = Math.max(0.1, parseFloat((prev + delta).toFixed(1)));
          return next;
      });
  };

  const handleSaveToLog = () => {
    if (result && baseMacros) {
        // Create a modified result object with the Calculated Macros
        const finalEntry: FoodAnalysis = {
            ...result,
            macros: currentMacros
        };
        
        onAddToHistory({ 
            id: Date.now().toString(), 
            timestamp: Date.now(), 
            analysis: finalEntry 
        });
        handleRetake(); 
    }
  };

  if (showHistory) {
    return (
      <div className="h-full w-full flex flex-col p-8 pt-16 bg-black">
        <div className="flex items-center gap-6 mb-12">
          <button onClick={() => setShowHistory(false)} className="glass-card p-3 rounded-2xl active:scale-95 transition-transform"><ArrowLeft size={20}/></button>
          <h1 className="text-3xl font-black text-white leading-none tracking-tight">Scan <span className="text-luxury-neon">Log</span></h1>
        </div>
        <div className="flex-1 overflow-y-auto space-y-5 pb-[calc(12rem+env(safe-area-inset-bottom))] no-scrollbar">
          {history.length === 0 ? <p className="text-center text-gray-700 mt-24 text-sm font-bold uppercase tracking-widest">Database Empty</p> : history.map(item => (
            <div key={item.id} className="glass-card p-6 rounded-[2rem] flex justify-between items-center border border-white/5">
              <div>
                <h3 className="font-black text-white">{item.analysis.name}</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">{new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
              </div>
              <div className="text-right">
                <span className="block font-black text-luxury-neon text-xl">{item.analysis.macros.calories}</span>
                <span className="text-[10px] uppercase text-gray-600 font-black tracking-widest">KCAL</span>
              </div>
            </div>
          ))}
          <div className="h-32"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative bg-black overflow-hidden flex flex-col">
      <canvas ref={canvasRef} className="hidden" />
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
      
      {/* -----------------------------------------------------------
          1. BASE LAYER: CAMERA FEED 
         ----------------------------------------------------------- */}
      <div className="absolute inset-0 z-0 bg-black">
        {inputType === 'text' ? (
           <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-black opacity-90"></div>
        ) : capturedImage ? (
           <img src={capturedImage} className="w-full h-full object-cover" alt="Frozen Frame" />
        ) : stream ? (
           <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
           <div className="h-full w-full flex flex-col items-center justify-center bg-black gap-6 px-6">
             <div className="w-40 h-40 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl flex items-center justify-center relative">
               <div className="w-24 h-24 rounded-full border-2 border-luxury-neon/60" />
               <div className="absolute inset-8 rounded-full border border-cyan-400/40" />
             </div>
             <button onClick={startCamera} className="px-6 py-3 rounded-full bg-luxury-neon text-black text-[10px] font-black uppercase tracking-[0.2em]">
               Initialize Camera Optics
             </button>
             <div className="glass-card rounded-2xl p-4 border border-white/10 bg-white/5 max-w-sm text-center">
               <p className="text-[10px] text-luxury-neon font-black uppercase tracking-widest mb-1">Analysis & Goal Alignment Protocol</p>
               <p className="text-xs text-gray-400">Align scans with your calorie and macro objectives in real time.</p>
             </div>
           </div>
        )}
      </div>

      {!result && !analyzing && inputType === 'camera' && (
        <>
            {/* -----------------------------------------------------------
                2. CENTER LAYER: FOCUS FRAME
               ----------------------------------------------------------- */}
            
            {/* A. Darkened Mask (SVG Hole) - Matches brackets 70% width / 50% height centered */}
            <div className="absolute inset-0 z-10 pointer-events-none">
              <svg className="w-full h-full">
                <defs>
                  <mask id="viewfinder-mask">
                    <rect width="100%" height="100%" fill="white" />
                    {/* Centered Rectangle: X=15%, Y=25%, W=70%, H=50% */}
                    <rect x="15%" y="25%" width="70%" height="50%" rx="32" fill="black" />
                  </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#viewfinder-mask)" />
              </svg>
            </div>

            {/* B. The Brackets & Scan Line Container */}
            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
              <div className="relative w-[70%] h-[50%]">
                 {/* Top Left */}
                 <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-luxury-neon rounded-tl-2xl shadow-[0_0_15px_rgba(206,242,69,0.5)]"></div>
                 {/* Top Right */}
                 <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-luxury-neon rounded-tr-2xl shadow-[0_0_15px_rgba(206,242,69,0.5)]"></div>
                 {/* Bottom Left */}
                 <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-luxury-neon rounded-bl-2xl shadow-[0_0_15px_rgba(206,242,69,0.5)]"></div>
                 {/* Bottom Right */}
                 <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-luxury-neon rounded-br-2xl shadow-[0_0_15px_rgba(206,242,69,0.5)]"></div>
                 
                 {/* C. Laser Scanning Animation */}
                 <motion.div 
                   animate={scanLineControls} 
                   className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-luxury-neon to-transparent opacity-0 shadow-[0_0_20px_#CEF245]" 
                 />
              </div>
            </div>

            {/* -----------------------------------------------------------
                3. TOP LAYER: STATUS & SETTINGS
               ----------------------------------------------------------- */}
            <div className="absolute top-0 left-0 right-0 z-30 pt-12 px-6 pb-6 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
               {/* Left: History */}
               <button onClick={() => setShowHistory(true)} className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center border border-white/10 active:scale-90 transition-all shadow-xl group">
                  <History size={20} className="text-gray-300 group-hover:text-white transition-colors"/>
               </button>

               {/* Center: Status Pill */}
               <div className="px-6 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-3 shadow-2xl">
                  <div className="w-2 h-2 bg-luxury-neon rounded-full animate-pulse shadow-[0_0_10px_#CEF245]"></div>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">Focus Frame</span>
               </div>

               {/* Right: Keyboard Mode */}
               <button onClick={() => setInputType(prev => prev === 'camera' ? 'text' : 'camera')} className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center border border-white/10 active:scale-90 transition-all shadow-xl group">
                  {inputType === 'camera' ? <Keyboard size={20} className="text-gray-300 group-hover:text-white transition-colors"/> : <Camera size={20} className="text-gray-300 group-hover:text-white transition-colors"/>}
               </button>
            </div>

            {/* -----------------------------------------------------------
                4. BOTTOM LAYER: CAMERA CONTROLS
               ----------------------------------------------------------- */}
            <div className="absolute bottom-0 left-0 right-0 z-30 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-evenly">
               
               {/* Left: Gallery Icon */}
               <button 
                  onClick={handleGalleryClick} 
                  className="w-14 h-14 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-gray-300 hover:text-white active:scale-90 transition-all shadow-lg"
               >
                  <ImageIcon size={22} />
               </button>

               {/* Center: HERO CAPTURE BUTTON */}
               <button 
                  onClick={() => captureAndAnalyze()}
                  className="relative w-[84px] h-[84px] flex items-center justify-center group active:scale-95 transition-transform duration-100"
               >
                  {/* Outer Glow Ring */}
                  <div className="absolute inset-0 rounded-full border-[2px] border-white/30 bg-white/5 backdrop-blur-sm group-hover:border-luxury-neon/50 transition-colors shadow-[0_0_25px_rgba(255,255,255,0.1)] group-hover:shadow-[0_0_40px_rgba(206,242,69,0.3)]"></div>
                  
                  {/* Inner Solid Circle */}
                  <div className="w-[65px] h-[65px] bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)]"></div>
               </button>

               {/* Right: Flash Toggle */}
               <button 
                  onClick={toggleFlash}
                  className={`w-14 h-14 rounded-full backdrop-blur-md border flex items-center justify-center transition-all shadow-lg active:scale-90 ${flashOn ? 'bg-luxury-neon/20 border-luxury-neon text-luxury-neon' : 'bg-white/5 border-white/10 text-gray-300'}`}
               >
                  {flashOn ? <Zap size={22} fill="currentColor" /> : <ZapOff size={22} />}
               </button>

            </div>
        </>
      )}

      {/* 5. Text Input Mode Overlay */}
      <AnimatePresence>
        {!result && inputType === 'text' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 pointer-events-auto">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl">
                    <h2 className="text-lg font-black uppercase tracking-widest text-white mb-4">Manual Entry</h2>
                    <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Grilled Salmon with Quinoa..." className="w-full h-32 bg-black/40 border border-white/10 rounded-2xl p-4 text-white placeholder-gray-600 outline-none focus:border-luxury-neon transition-all resize-none mb-6 text-sm font-medium" />
                    <button onClick={performTextAnalysis} disabled={!textInput.trim() || analyzing} className="w-full py-4 bg-luxury-neon text-black font-black uppercase text-xs tracking-widest rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                        {analyzing ? <Loader2 className="animate-spin" /> : <><Zap size={18} /> Analyze</>}
                    </button>
                    <button onClick={() => setInputType('camera')} className="w-full mt-3 py-3 text-gray-500 font-bold uppercase text-[10px] tracking-widest hover:text-white transition-colors">Cancel</button>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* 6. Loading State */}
      <AnimatePresence>
        {analyzing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-2xl flex flex-col items-center justify-center z-[110] pointer-events-auto">
                <div className="relative mb-12">
                    <div className="w-24 h-24 rounded-full border-2 border-white/5 border-t-luxury-neon animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <BrainCircuit className="text-luxury-neon animate-pulse" size={32} />
                    </div>
                </div>
                <p className="text-luxury-neon font-black uppercase tracking-[0.5em] text-[11px] animate-pulse">Scanning Bio-Log</p>
            </motion.div>
        )}
      </AnimatePresence>

      {/* 7. Result Modal Bottom Sheet */}
      <AnimatePresence>
        {result && (
          <motion.div 
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            className="absolute bottom-0 left-0 right-0 z-[120] rounded-t-[3rem] bg-[#0A0A0A] border-t border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.9)] max-h-[92vh] overflow-y-auto no-scrollbar"
          >
            <div className="p-10 pb-[calc(11rem+env(safe-area-inset-bottom))] relative">
                <div className="w-14 h-1.5 bg-white/10 rounded-full mx-auto mb-10"></div>
                <div className="flex justify-between items-start mb-10">
                    <div className="flex-1 mr-6">
                        <p className="text-[11px] font-black text-gray-500 uppercase tracking-[0.3em] mb-2">Nutritional Identity</p>
                        {isEditingName ? (
                          <div className="flex flex-col gap-3">
                             <input type="text" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Correct name..." className="w-full bg-white/5 border border-luxury-neon text-white text-xl font-bold p-4 rounded-2xl outline-none" autoFocus />
                             <div className="flex gap-3">
                                <button onClick={() => capturedImage && performAnalysis(capturedImage, manualName)} className="flex-1 py-3 bg-luxury-neon text-black text-xs font-black uppercase rounded-xl">Update</button>
                                <button onClick={() => setIsEditingName(false)} className="flex-1 py-3 bg-white/10 text-white text-xs font-black uppercase rounded-xl">Cancel</button>
                             </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setIsEditingName(true)}>
                              <h2 className="text-4xl font-black text-white leading-tight tracking-tighter group-hover:text-luxury-neon transition-colors">{result.name}</h2>
                              <Edit2 size={18} className="text-gray-600 group-hover:text-luxury-neon transition-colors" />
                          </div>
                        )}
                    </div>
                    <button onClick={handleRetake} className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-full text-white border border-white/10 hover:bg-white/10 transition-colors shadow-lg"><X size={22} /></button>
                </div>

                {/* --- DYNAMIC PORTION CONTROL ROW --- */}
                <div className="flex items-center justify-between gap-4 mb-8">
                    {/* Quantity Stepper (Glass Pill) */}
                    <div className="flex-1 h-16 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between px-2">
                        <button onClick={() => adjustQuantity(-0.5)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-luxury-neon active:bg-white/10 transition-colors">
                            <Minus size={18} />
                        </button>
                        <input 
                            type="number" 
                            value={quantity} 
                            onChange={(e) => setQuantity(Math.max(0.1, parseFloat(e.target.value) || 0))} 
                            className="bg-transparent w-full text-center text-2xl font-black text-white outline-none"
                        />
                        <button onClick={() => adjustQuantity(0.5)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-luxury-neon active:bg-white/10 transition-colors">
                            <Plus size={18} />
                        </button>
                    </div>

                    {/* Unit Selector (Glass Box) */}
                    <div className="relative w-36 h-16 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center">
                        <select 
                            value={unit} 
                            onChange={(e) => setUnit(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                        >
                            <option value="Serving">Serving</option>
                            <option value="Piece">Piece</option>
                            <option value="Cup">Cup</option>
                            <option value="Plate">Plate</option>
                            <option value="Bowl">Bowl</option>
                        </select>
                        <div className="flex items-center gap-2 pointer-events-none">
                            <span className="text-sm font-bold text-white uppercase tracking-wider">{unit}</span>
                            <ChevronDown size={14} className="text-luxury-neon" />
                        </div>
                    </div>
                </div>
                
                {/* DYNAMIC CALORIE DISPLAY */}
                <div className="p-10 rounded-[3rem] border border-white/5 bg-white/[0.03] flex justify-between items-center mb-10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-luxury-neon/20 to-transparent"></div>
                    <div>
                        <span className="block text-5xl font-black text-white tracking-tighter mb-1">
                            {currentMacros.calories.toLocaleString()}
                        </span>
                        <span className="text-[11px] uppercase font-black tracking-[0.4em] text-gray-500">Burn Unit / Kcal</span>
                    </div>
                    <div className="text-right">
                        <span className="block text-3xl font-black text-luxury-neon mb-1">{result.healthScore}<span className="text-sm text-gray-600 ml-1">Score</span></span>
                        <span className="text-[11px] uppercase font-black tracking-[0.4em] text-gray-500">Bio-Efficiency</span>
                    </div>
                </div>

                <div className="space-y-6 mb-12">
                    <div className="flex gap-5">
                        <button onClick={handleRetake} className="flex-1 py-5 bg-white/5 text-white font-black uppercase text-[10px] tracking-[0.3em] rounded-[2rem] border border-white/10 flex items-center justify-center gap-2 hover:bg-white/10 transition-all"><RefreshCw size={16} /> Retake</button>
                        <button onClick={handleSaveToLog} className="flex-1 py-5 bg-luxury-neon text-black font-black uppercase text-[10px] tracking-[0.3em] rounded-[2rem] shadow-2xl flex items-center justify-center gap-2 hover:scale-105 transition-all"><CheckCircle size={18} /> Confirm Log</button>
                    </div>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FoodLens;
