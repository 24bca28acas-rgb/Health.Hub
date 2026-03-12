
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Weight, Ruler, Calendar, Activity, LogOut, Edit3, Save, X, Camera, Loader2, AlertCircle, CheckCircle, Trash2, AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react';
import { UserProfile, UserMetrics } from '../types';
import { signOut, updateProfile, updateUserMetrics, supabase, DEFAULT_AVATAR } from '../services/supabase';

interface ProfileScreenProps {
  onUpdateMetrics: (metrics: UserMetrics) => void;
  onUpdateProfile?: (profile: UserProfile) => void;
}

interface SnackBarState {
    show: boolean;
    message: string;
    type: 'success' | 'error';
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onUpdateMetrics, onUpdateProfile }) => {
  // --- REAL DATA STATE ---
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dbMetrics, setDbMetrics] = useState<UserMetrics | null>(null);

  // --- UI EDITING STATE ---
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [tempMetrics, setTempMetrics] = useState<UserMetrics>({ height: 0, weight: 0 });
  const [tempGoals, setTempGoals] = useState({ stepGoal: 10000, calorieGoal: 2000, distanceGoal: 5.0 });
  const [tempName, setTempName] = useState('');
  const [tempAvatar, setTempAvatar] = useState(DEFAULT_AVATAR);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [snackBar, setSnackBar] = useState<SnackBarState>({ show: false, message: '', type: 'success' });

  // --- AGE CALCULATION LOGIC ---
  const calculateAge = (dobString: string | undefined): number => {
    if (!dobString) return 25; // Default fallback
    try {
      const birthDate = new Date(dobString);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return isNaN(age) ? 25 : age;
    } catch (e) {
      return 25;
    }
  };

  // --- FETCH REAL DATA (React "initState") ---
  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated session.");

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        // Map database fields to local profile state
        const mappedProfile: UserProfile = {
          id: data.id,
          name: data.name || 'Elite Member',
          email: data.email || '',
          avatarUrl: data.avatar_url || DEFAULT_AVATAR,
          metrics: data.metrics || {}
        };

        const metrics: UserMetrics = {
          height: data.height || data.metrics?.height || 0,
          weight: data.weight || data.metrics?.weight || 0,
          dob: data.metrics?.dob || '',
          age: data.metrics?.age || calculateAge(data.metrics?.dob),
          activityLevel: data.metrics?.activityLevel || 'Moderately Active',
          fitnessGoal: data.metrics?.fitnessGoal || 'Maintain'
        };

        setProfile(mappedProfile);
        setDbMetrics(metrics);
        setTempMetrics(metrics);
        setTempGoals({
          stepGoal: mappedProfile.goals?.stepGoal || 10000,
          calorieGoal: mappedProfile.goals?.calorieGoal || 2000,
          distanceGoal: mappedProfile.goals?.distanceGoal || 5.0
        });
        setTempName(mappedProfile.name);
        setTempAvatar(mappedProfile.avatarUrl);
      }
    } catch (e: any) {
      console.error("Profile Fetch Error:", e);
      setSnackBar({ show: true, message: "Sync error. Check connection.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  // --- ACTIONS ---
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update both table columns and the jsonb metrics object for maximum safety
      const updatedMetrics = { 
        ...tempMetrics, 
        age: calculateAge(tempMetrics.dob) 
      };

      // Consolidated call with extreme debugging enabled in service
      await updateProfile(user, { 
        displayName: tempName, 
        photoURL: tempAvatar,
        metrics: updatedMetrics,
        goals: tempGoals
      });
      
      onUpdateMetrics(updatedMetrics);
      if (onUpdateProfile) {
        onUpdateProfile({
          ...profile,
          name: tempName,
          avatarUrl: tempAvatar,
          metrics: updatedMetrics,
          goals: tempGoals
        });
      }
      setSnackBar({ show: true, message: "Identity records synchronized.", type: 'success' });
      setIsEditing(false);
      await fetchProfileData(); // Refresh UI with fresh DB data
    } catch (e: any) {
      console.error("Save Error:", e);
      setSnackBar({ show: true, message: "Failed to update record.", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      // Execute the local signout protocol
      await signOut();
    } catch (err) {
      console.error("Logout process error:", err);
    } finally {
      // Force hard navigation back to root to wipe all memory/state
      window.location.href = window.location.origin;
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw error;
      await handleSignOut();
    } catch (e: any) {
      setSnackBar({ show: true, message: "Deletion protocol failed.", type: 'error' });
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-black">
        <Loader2 className="animate-spin text-luxury-neon" size={40} />
        <p className="mt-4 text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] animate-pulse">Syncing Profile</p>
      </div>
    );
  }

  if (!profile || !dbMetrics) return null;

  return (
    <div className="h-full w-full flex flex-col bg-black overflow-y-auto no-scrollbar pb-[calc(10rem+env(safe-area-inset-bottom))] relative">
      
      {/* MODALS & NOTIFICATIONS */}
      <AnimatePresence>
        {showDeleteConfirm && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-8">
              <div className="w-full max-w-sm glass-card p-8 rounded-3xl border border-red-500/20 text-center">
                 <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6 text-red-500"><Trash2 size={32} /></div>
                 <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Delete Account?</h3>
                 <p className="text-red-400/80 text-[11px] mb-8 font-bold uppercase tracking-widest leading-relaxed">This action is permanent and cannot be undone. Are you sure?</p>
                 <div className="flex flex-col gap-3">
                    <button onClick={handleDeleteAccount} disabled={isDeleting} className="w-full py-4 bg-red-600 rounded-2xl text-white font-black text-xs uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2">
                       {isDeleting ? <Loader2 size={16} className="animate-spin" /> : "Confirm Deletion"}
                    </button>
                    <button onClick={() => setShowDeleteConfirm(false)} className="w-full py-4 bg-white/5 rounded-2xl text-white font-bold text-xs uppercase tracking-widest">Cancel</button>
                 </div>
              </div>
           </motion.div>
        )}

        {snackBar.show && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`fixed top-12 left-6 right-6 z-[120] p-4 rounded-xl flex items-center gap-3 border backdrop-blur-md ${snackBar.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-200' : 'bg-green-500/10 border-green-500/30 text-green-200'}`}>
                {snackBar.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                <p className="text-xs font-bold">{snackBar.message}</p>
            </motion.div>
        )}
      </AnimatePresence>

      <input type="file" ref={fileInputRef} onChange={(e) => {
        if (e.target.files?.[0]) {
          const reader = new FileReader();
          reader.onload = (ev) => setTempAvatar(ev.target?.result as string);
          reader.readAsDataURL(e.target.files[0]);
        }
      }} className="hidden" accept="image/*" />

      {/* HEADER SECTION */}
      <div className="relative h-72 shrink-0 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-luxury-neon/5 to-transparent"></div>
        <div className="relative z-10 flex flex-col items-center">
          <div onClick={() => isEditing && fileInputRef.current?.click()} className="relative cursor-pointer group">
            <div className={`absolute -inset-1 rounded-full blur opacity-30 transition duration-1000 ${isEditing ? 'bg-luxury-neon animate-pulse' : 'bg-white/10'}`}></div>
            <img src={tempAvatar} className={`relative w-32 h-32 rounded-full border-4 bg-black object-cover transition-all ${isEditing ? 'border-luxury-neon scale-105 shadow-[0_0_25px_rgba(206,242,69,0.3)]' : 'border-white/10'}`} alt="Avatar" />
            {isEditing && <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center"><Camera size={24} className="text-luxury-neon" /></div>}
          </div>

          <div className="mt-6 flex flex-col items-center gap-2">
            {isEditing ? (
              <input type="text" value={tempName} onChange={e => setTempName(e.target.value)} className="bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-xl font-black text-white text-center focus:border-luxury-neon outline-none" placeholder="Name" />
            ) : (
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">{profile.name}</h2>
            )}
            <p className="text-gray-500 text-[9px] font-black uppercase tracking-[0.4em] flex items-center gap-2"><Mail size={10} /> {profile.email}</p>
          </div>
        </div>
      </div>

      {/* EDIT ACTIONS */}
      <div className="px-6 mb-8 flex justify-center">
        {!isEditing ? (
           <button onClick={() => setIsEditing(true)} className="px-8 py-3 rounded-full border border-luxury-neon/30 text-luxury-neon text-[10px] font-black uppercase tracking-[0.2em] hover:bg-luxury-neon hover:text-black transition-all flex items-center gap-2">
             <Edit3 size={14} /> Update Identity
           </button>
        ) : (
           <div className="flex gap-4">
             <button onClick={() => { setIsEditing(false); setTempMetrics(dbMetrics); setTempName(profile.name); setTempAvatar(profile.avatarUrl); }} className="px-6 py-3 rounded-full bg-white/5 text-white text-[10px] font-black uppercase tracking-[0.2em]">Cancel</button>
             <button onClick={handleSave} disabled={isSaving} className="px-8 py-3 rounded-full bg-luxury-neon text-black text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-luxury-neon/20 flex items-center gap-2">
               {isSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14} />} Save Sync
             </button>
           </div>
        )}
      </div>

      {/* METRICS GRID */}
      <div className="px-6">
        <div className="glass-card p-6 rounded-[2.5rem] border border-white/5">
           <div className="grid grid-cols-2 gap-4">
             <MetricCard 
               icon={<Weight size={18} />} 
               label="Mass" 
               value={isEditing ? 
                 <input type="number" className="bg-transparent w-full text-center outline-none text-white font-black" value={tempMetrics.weight || ''} onChange={e => setTempMetrics({...tempMetrics, weight: parseFloat(e.target.value) || 0})} /> : 
                 (dbMetrics.weight || 0)
               } 
               unit="kg" 
               editable={isEditing}
             />
             <MetricCard 
               icon={<Ruler size={18} />} 
               label="Height" 
               value={isEditing ? 
                 <input type="number" className="bg-transparent w-full text-center outline-none text-white font-black" value={tempMetrics.height || ''} onChange={e => setTempMetrics({...tempMetrics, height: parseFloat(e.target.value) || 0})} /> : 
                 (dbMetrics.height || 0)
               } 
               unit="cm" 
               editable={isEditing}
             />
             <MetricCard 
               icon={<Calendar size={18} />} 
               label="Biological Age" 
               value={isEditing ? 
                 <input type="date" className="bg-transparent w-full text-center outline-none text-white font-bold text-[10px]" value={tempMetrics.dob || ''} onChange={e => setTempMetrics({...tempMetrics, dob: e.target.value})} /> : 
                 calculateAge(dbMetrics.dob)
               } 
               unit="yrs" 
               editable={isEditing}
             />
             <MetricCard 
               icon={<Activity size={18} />} 
               label="Activity Level" 
               value={isEditing ?
                 <select className="bg-transparent w-full text-center outline-none text-white font-bold text-[10px] appearance-none" value={tempMetrics.activityLevel} onChange={e => setTempMetrics({...tempMetrics, activityLevel: e.target.value as any})}>
                   <option value="Sedentary">Sedentary</option>
                   <option value="Lightly Active">Lightly Active</option>
                   <option value="Moderately Active">Moderately Active</option>
                   <option value="Very Active">Very Active</option>
                 </select> :
                 dbMetrics.activityLevel
               } 
               unit="" 
               isActivity
               editable={isEditing}
             />
           </div>
        </div>

        {/* SETTINGS SECTION */}
        <div className="mt-8 space-y-3">
           <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.4em] px-4 mb-2">System Controls</p>
           
           <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-5 px-6 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-all">
              <div className="flex items-center gap-3">
                 <RefreshCw size={16} className="text-gray-400 group-hover:text-white" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Clear Local Cache</span>
              </div>
              <ChevronRight size={14} className="text-gray-700" />
           </button>

           <button onClick={handleSignOut} className="w-full py-5 px-6 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-all">
              <div className="flex items-center gap-3">
                 <LogOut size={16} className="text-gray-400 group-hover:text-white" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Sign Out System</span>
              </div>
              <ChevronRight size={14} className="text-gray-700" />
           </button>

           <button onClick={() => setShowDeleteConfirm(true)} className="w-full py-5 px-6 bg-red-600/5 border border-red-600/10 rounded-2xl flex items-center justify-between group hover:bg-red-600/10 transition-all">
              <div className="flex items-center gap-3">
                 <Trash2 size={16} className="text-red-500/70" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-red-500/70">Delete Account</span>
              </div>
              <AlertTriangle size={14} className="text-red-900" />
           </button>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ icon: React.ReactNode, label: string, value: any, unit: string, isActivity?: boolean, editable?: boolean }> = ({ icon, label, value, unit, isActivity, editable }) => (
  <div className={`p-5 rounded-[2.5rem] flex flex-col items-center justify-center text-center transition-all border ${editable ? 'bg-luxury-neon/5 border-luxury-neon/20' : 'bg-transparent border-white/5'}`}>
    <div className={`mb-2 ${editable ? 'text-luxury-neon' : 'text-gray-600'}`}>{icon}</div>
    <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</span>
    <div className="flex items-baseline gap-1 justify-center w-full">
      <span className={`text-lg font-black text-white ${isActivity ? 'capitalize truncate max-w-full text-[10px]' : ''}`}>{value}</span>
      {!isActivity && unit && <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{unit}</span>}
    </div>
  </div>
);

export default ProfileScreen;
