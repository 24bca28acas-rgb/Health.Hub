
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Loader2, Brain, Zap, Settings2, Trash2, AlertCircle, Info, CheckCircle2, ArrowRight } from 'lucide-react';
import { getCoachChatStream } from '../services/geminiService';
import { fetchChatHistory, saveChatMessage, supabase, updateUserTargets, clearChatHistory } from '../services/supabase';
import { ChatMessage, UserMetrics, ActivityData, UserProfile } from '../types';
import { Content } from '@google/genai';
import useLocalStorage from '../hooks/useLocalStorage';

interface ChatBotProps {
  profile: UserProfile;
  activity: ActivityData;
  onUpdateTargets?: (calories: number, steps: number, planName: string) => void;
}

const ChatBot: React.FC<ChatBotProps> = ({ profile, activity, onUpdateTargets }) => {
  const [messages, setMessages] = useState<(ChatMessage & { plan_data?: any })[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [applyingPlan, setApplyingPlan] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [thinkingMode, setThinkingMode] = useLocalStorage<boolean>('ai_thinking_mode', false);
  const [showSettings, setShowSettings] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    const initChat = async () => {
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) return;
       setUserId(user.id);
       try {
           const history = await fetchChatHistory(user.id);
           setMessages(history.map(h => ({
               id: h.id, 
               role: h.is_user_message ? 'user' : 'model', 
               text: h.message, 
               timestamp: new Date(h.created_at).getTime(),
               plan_data: h.plan_data
           })));
       } finally { setIsLoading(false); }
    };
    initChat();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping, isThinking]);

  const handleClearHistory = async () => {
    if (!userId) return;
    try {
      await clearChatHistory(userId);
      setMessages([]);
      setShowClearConfirm(false);
      setShowSettings(false);
    } catch (e) {
      console.error("Clear Error", e);
    }
  };

  const handleApplyPlan = async (msgId: string, planData: any) => {
    if (!userId) return;
    setApplyingPlan(msgId);
    try {
      await updateUserTargets(userId, planData);
      if (onUpdateTargets) {
        onUpdateTargets(
          planData.target_calories || planData.calories, 
          planData.target_steps || planData.steps, 
          planData.plan_name
        );
      }
      // UI update for this specific message
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, plan_applied: true } : m));
    } catch (e) {
      console.error("Apply Plan Failure", e);
    } finally {
      setApplyingPlan(null);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isTyping || !userId) return;

    const userText = input;
    
    const userMsg: ChatMessage = { 
      id: Date.now().toString(), 
      role: 'user', 
      text: userText, 
      timestamp: Date.now() 
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    if (thinkingMode) setIsThinking(true);
    
    saveChatMessage(userId, userText, true).catch(console.error);

    try {
      const historyContext: Content[] = messages
        .slice(-10)
        .map(h => ({
          role: h.role,
          parts: [{ text: h.text }]
        }));

      const stream = await getCoachChatStream(
        userText, 
        historyContext, 
        profile, 
        activity, 
        thinkingMode
      );
      
      const coachId = (Date.now() + 1).toString();
      let coachText = '';
      
      setMessages(prev => [...prev, { id: coachId, role: 'model', text: '', timestamp: Date.now() }]);
      setIsThinking(false);

      for await (const chunk of stream) {
        coachText += chunk.text || '';
        setMessages(prev => prev.map(m => m.id === coachId ? { ...m, text: coachText } : m));
      }

      // Sync Protocol Logic (Plan detection)
      const protocolMatch = coachText.match(/SYNC_PROTOCOL:\s*(\{.*\})/);
      let planData = null;
      if (protocolMatch) {
          try {
              planData = JSON.parse(protocolMatch[1]);
              setMessages(prev => prev.map(m => m.id === coachId ? { ...m, plan_data: planData } : m));
          } catch (e) { console.error("Parse Failure", e); }
      }

      await saveChatMessage(userId, coachText, false, planData);

    } catch (error: any) {
      console.error("Coach protocol failure:", error);
      let errorMsg = "The elite neural network is recalibrating. I've logged your request and will be fully synchronized in a moment.";
      if (error.message?.includes("QUOTA_EXHAUSTED")) {
        errorMsg = "System Overload: The AI processing quota is reached. Try switching off 'Deep Reason Protocol' in settings.";
      }
      setMessages(prev => [...prev, { 
        id: 'err-' + Date.now(), 
        role: 'model', 
        text: errorMsg, 
        timestamp: Date.now() 
      }]);
    } finally { 
      setIsTyping(false); 
      setIsThinking(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#050505] relative font-sans">
      {/* Header */}
      <div className="p-6 pt-12 flex items-center justify-between border-b border-white/5 z-10 bg-black/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-700 ${thinkingMode ? 'border-luxury-neon/50 bg-luxury-neon/5 shadow-[0_0_20px_rgba(206,242,69,0.2)]' : 'border-white/10 bg-white/5'}`}>
            {thinkingMode ? <Brain size={24} className="text-luxury-neon" /> : <Zap size={24} className="text-gray-400" />}
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight uppercase">AI Coach</h1>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] uppercase font-black tracking-[0.2em] ${thinkingMode ? 'text-luxury-neon' : 'text-gray-500'}`}>
                 {thinkingMode ? 'Hyper-Intelligence' : 'Eco Response'}
              </span>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => setShowSettings(!showSettings)} 
          className={`p-3 rounded-full border transition-all ${showSettings ? 'bg-luxury-neon text-black border-luxury-neon' : 'bg-white/5 text-gray-500 border-white/10'}`}
        >
          <Settings2 size={18} />
        </button>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-white/[0.02] border-b border-white/10 overflow-hidden shrink-0">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Deep Reason Protocol</p>
                    <Info size={10} className="text-gray-600" />
                  </div>
                  <p className="text-[8px] text-gray-500 uppercase tracking-widest">Uses more API quota (Gemini Pro)</p>
                </div>
                <button 
                  onClick={() => setThinkingMode(!thinkingMode)} 
                  className={`w-12 h-6 rounded-full relative transition-all duration-300 ${thinkingMode ? 'bg-luxury-neon' : 'bg-white/10'}`}
                >
                  <motion.div 
                    animate={{ x: thinkingMode ? 26 : 4 }}
                    className={`absolute top-1 w-4 h-4 rounded-full ${thinkingMode ? 'bg-black' : 'bg-gray-400'}`}
                  />
                </button>
              </div>
              <div className="h-px bg-white/5 w-full"></div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Erase Archive</p>
                  <p className="text-[8px] text-gray-500 uppercase tracking-widest">Wipe conversational history</p>
                </div>
                <button 
                  onClick={() => setShowClearConfirm(true)}
                  className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-hidden relative flex flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {messages.length === 0 && !isTyping && (
            <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-4 opacity-50">
              <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 mb-4">
                <Sparkles size={32} className="text-luxury-neon" />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">System Ready</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
                Your elite AI coach is synchronized. How can we optimize your status today?
              </p>
            </div>
          )}
          
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-luxury-neon text-black font-bold shadow-[0_4px_15px_rgba(206,242,69,0.15)]' : 'bg-white/5 text-white border border-white/5 backdrop-blur-sm'}`}>
                    {msg.text.replace(/SYNC_PROTOCOL:\s*\{.*\}/, '').trim()}
                </div>

                {/* Detect SYNC_PROTOCOL JSON and show the "APPLY PLAN" button */}
                {msg.plan_data && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-3 w-full max-w-[80%]">
                    <div className="glass-card rounded-2xl border border-luxury-neon/20 p-4 bg-luxury-neon/5">
                      <div className="flex items-center gap-3 mb-3">
                         <div className="w-8 h-8 rounded-full bg-luxury-neon/10 flex items-center justify-center text-luxury-neon">
                            <Sparkles size={16} />
                         </div>
                         <h4 className="text-[11px] font-black text-white uppercase tracking-widest">{msg.plan_data.plan_name || 'Optimization Protocol'}</h4>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="text-center p-2 bg-white/5 rounded-xl border border-white/5">
                          <p className="text-[8px] font-bold text-gray-500 uppercase mb-1">Steps</p>
                          <p className="text-xs font-black text-white">{msg.plan_data.target_steps || msg.plan_data.steps}</p>
                        </div>
                        <div className="text-center p-2 bg-white/5 rounded-xl border border-white/5">
                          <p className="text-[8px] font-bold text-gray-500 uppercase mb-1">Calories</p>
                          <p className="text-xs font-black text-white">{msg.plan_data.target_calories || msg.plan_data.calories}</p>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleApplyPlan(msg.id, msg.plan_data)}
                        disabled={(msg as any).plan_applied || applyingPlan === msg.id}
                        className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                          (msg as any).plan_applied 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : 'bg-luxury-neon text-black shadow-[0_0_15px_rgba(206,242,69,0.2)]'
                        }`}
                      >
                        {(msg as any).plan_applied ? <><CheckCircle2 size={14} /> Protocol Applied</> : applyingPlan === msg.id ? <Loader2 size={14} className="animate-spin" /> : <><ArrowRight size={14} /> Sync to Profile</>}
                      </button>
                    </div>
                  </motion.div>
                )}
            </div>
          ))}
          
          {isThinking && (
            <div className="flex flex-col items-start">
              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.div key={i} animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, delay: i * 0.2, duration: 1 }} className="w-1.5 h-1.5 bg-luxury-neon rounded-full" />
                  ))}
                </div>
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest italic">Reasoning in progress...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar - Docked WhatsApp Style */}
        <div className="w-full bg-black border-t border-white/10 shrink-0 px-4 py-3">
          <form onSubmit={handleSend} className="flex items-center gap-3">
            <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl px-5 py-3 transition-all focus-within:border-luxury-neon/40 shadow-inner">
              <input 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder="Message AI Coach..." 
                className="w-full bg-transparent text-sm text-white placeholder-gray-700 outline-none" 
              />
            </div>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              type="submit" 
              disabled={isTyping || !input.trim()} 
              className="w-12 h-12 rounded-full bg-luxury-neon text-black flex items-center justify-center disabled:opacity-30 transition-all shadow-[0_0_15px_rgba(206,242,69,0.3)] shrink-0"
            >
              {isTyping ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            </motion.button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
