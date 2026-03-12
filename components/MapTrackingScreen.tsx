
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, Timer, Footprints, Map as MapIcon, Loader2, Save, Trash2, CheckCircle } from 'lucide-react';
import { supabase, incrementMapSession } from '../services/supabase';
import { ViewState } from '../types';

interface MapTrackingScreenProps {
  userHeight?: number;
  userWeight?: number;
  setView?: (view: ViewState) => void;
}

const CHENNAI_COORDS: [number, number] = [13.0827, 80.2707];

const locationIcon = L.divIcon({
  className: 'custom-location-icon',
  html: `<div class="w-5 h-5 bg-blue-500 rounded-full border-4 border-white shadow-[0_0_20px_rgba(59,130,246,0.8)] animate-pulse"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

const MapController = ({ center }: { center: [number, number] | null }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 18, { animate: true });
    }
  }, [center, map]);
  return null;
};

const MapTrackingScreen: React.FC<MapTrackingScreenProps> = ({ userHeight = 175, userWeight = 70, setView }) => {
  const [isStarted, setIsStarted] = useState(false);
  const [activityType, setActivityType] = useState<'Walking' | 'Cycling'>('Walking');
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [path, setPath] = useState<[number, number][]>([]);
  const [distance, setDistance] = useState(0); 
  const [elapsedTime, setElapsedTime] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const watchId = useRef<number | null>(null);
  const timerId = useRef<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });

    if ("geolocation" in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setPosition(newPos);
          
          if (isStarted) {
            setPath(prev => {
              if (prev.length > 0) {
                const last = prev[prev.length - 1];
                const d = L.latLng(last[0], last[1]).distanceTo(L.latLng(newPos[0], newPos[1]));
                if (d > 2) { 
                  setDistance(prevD => prevD + d);
                  return [...prev, newPos];
                }
              }
              return prev.length === 0 ? [newPos] : prev;
            });
          }
        },
        null,
        { enableHighAccuracy: true }
      );
    }
    return () => { if (watchId.current) navigator.geolocation.clearWatch(watchId.current); };
  }, [isStarted]);

  useEffect(() => {
    if (isStarted) {
      timerId.current = window.setInterval(() => setElapsedTime(t => t + 1), 1000);
    } else if (timerId.current) {
      clearInterval(timerId.current);
    }
    return () => { if (timerId.current) clearInterval(timerId.current); };
  }, [isStarted]);

  const handleToggle = () => {
    if (isStarted) {
      // Pause/Stop
      setIsStarted(false);
      setShowSaveModal(true);
    } else {
      // Start/Resume
      if (showSaveModal) {
         // If modal is open, we are technically paused. Resuming...
         setShowSaveModal(false);
         setIsStarted(true);
      } else {
        // Fresh Start
        setDistance(0);
        setElapsedTime(0);
        setPath(position ? [position] : []);
        setIsStarted(true);
      }
    }
  };

  const calculateStats = () => {
    const distanceKm = parseFloat((distance/1000).toFixed(3));
    let calories = 0;
    let steps = 0;

    if (activityType === 'Walking') {
      const strideLengthCm = userHeight * 0.415;
      steps = Math.floor((distance * 100) / strideLengthCm);
      // Walking formula: ~60 kcal per km (or MET based)
      calories = Math.floor(distanceKm * 60);
    } else {
      // Cycling formula: ~30 kcal per km (or MET based)
      calories = Math.floor(distanceKm * 30);
      steps = 0; // Cycling doesn't count as steps
    }

    return { steps, calories, distanceKm };
  };

  const handleSaveSession = async () => {
    if (!userId) return;
    setIsSaving(true);
    try {
      const stats = calculateStats();
      // Use incrementMapSession to safely ADD to the existing total (Delta Logic)
      await incrementMapSession(userId, stats.steps, stats.calories, stats.distanceKm);
      
      // Reset and Navigate
      setDistance(0);
      setElapsedTime(0);
      setPath([]);
      setShowSaveModal(false);
      if (setView) setView(ViewState.DASHBOARD);
    } catch (e) {
      console.error("Save Error", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setDistance(0);
    setElapsedTime(0);
    setPath([]);
    setShowSaveModal(false);
    setIsStarted(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const currentStats = calculateStats();

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <div className="absolute inset-0 z-0">
        <MapContainer center={CHENNAI_COORDS} zoom={13} className="h-full w-full" zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" className="map-tiles-dark" />
          <MapController center={position} />
          {path.length > 1 && <Polyline positions={path} pathOptions={{ color: '#CEF245', weight: 5 }} />}
          {position && <Marker position={position} icon={locationIcon} />}
        </MapContainer>
        {!position && (
           <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-10">
              <Loader2 className="animate-spin text-luxury-neon mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Acquiring Location...</p>
           </div>
        )}
      </div>

      <motion.div 
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="absolute bottom-6 left-6 right-6 z-20 glass-panel rounded-[2rem] p-6 shadow-2xl border border-white/10"
      >
        <div className="flex flex-col gap-6">
          {/* Activity Selection UI */}
          {!isStarted && !showSaveModal && (
            <div className="flex gap-3">
              <button 
                onClick={() => setActivityType('Walking')}
                className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${activityType === 'Walking' ? 'bg-luxury-neon border-luxury-neon text-black shadow-[0_0_15px_rgba(206,242,69,0.2)]' : 'bg-white/5 border-white/10 text-gray-500'}`}
              >
                Walking
              </button>
              <button 
                onClick={() => setActivityType('Cycling')}
                className={`flex-1 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${activityType === 'Cycling' ? 'bg-luxury-neon border-luxury-neon text-black shadow-[0_0_15px_rgba(206,242,69,0.2)]' : 'bg-white/5 border-white/10 text-gray-500'}`}
              >
                Cycling
              </button>
            </div>
          )}

          <div className="flex justify-between items-center px-2">
            <div className={`flex flex-col items-center gap-1 ${activityType === 'Walking' ? 'ml-[13px]' : 'ml-7'}`}>
              <Timer size={14} className="text-gray-500 mb-1" />
              <span className="text-xl font-black text-white tabular-nums">{formatTime(elapsedTime)}</span>
              <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Time</span>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className={`flex flex-col items-center gap-1 ${activityType === 'Walking' ? 'mr-0' : 'mr-7'}`}>
              <MapIcon size={14} className="text-gray-500 mb-1" />
              <span className="text-xl font-black text-white tabular-nums">{(distance/1000).toFixed(2)}</span>
              <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">KM</span>
            </div>
            {activityType === 'Walking' && (
              <>
                <div className="w-px h-8 bg-white/10"></div>
                <div className="flex flex-col items-center gap-1">
                  <Footprints size={14} className="text-gray-500 mb-1" />
                  <span className="text-xl font-black text-white tabular-nums">{currentStats.steps}</span>
                  <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Steps</span>
                </div>
              </>
            )}
          </div>

          <button 
            onClick={handleToggle}
            disabled={!position}
            className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-[0.2em] transition-all disabled:opacity-30 ${isStarted ? 'bg-red-500 text-white' : 'bg-luxury-neon text-black shadow-[0_0_20px_rgba(206,242,69,0.3)]'}`}
          >
            {isStarted ? <><Square size={14} fill="currentColor" /> Stop Track</> : <><Play size={14} fill="currentColor" /> Start Track</>}
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showSaveModal && (
          <div className="absolute inset-0 z-50 flex items-end justify-center">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/80 backdrop-blur-sm"
               onClick={() => setShowSaveModal(false)}
             />
             <motion.div 
               initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
               className="relative w-full bg-[#0A0A0A] rounded-t-[2.5rem] border-t border-white/10 p-8 pb-12 shadow-2xl"
             >
                <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-8"></div>
                
                <h2 className="text-2xl font-black text-white tracking-tight text-center mb-2">Session Complete</h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest text-center mb-8">Calculated Metrics</p>

                <div className={`grid gap-4 mb-8 ${activityType === 'Walking' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                   {activityType === 'Walking' && (
                     <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col items-center">
                        <span className="text-3xl font-black text-luxury-neon">{currentStats.steps}</span>
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-1">Steps Added</span>
                     </div>
                   )}
                   <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col items-center">
                      <span className="text-3xl font-black text-white">{currentStats.calories}</span>
                      <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-1">Kcal Burned</span>
                   </div>
                </div>

                <div className="flex gap-4">
                   <button 
                     onClick={handleDiscard}
                     disabled={isSaving}
                     className="flex-1 py-4 bg-white/5 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                   >
                      <Trash2 size={16} /> Discard
                   </button>
                   <button 
                     onClick={handleSaveSession}
                     disabled={isSaving}
                     className="flex-1 py-4 bg-luxury-neon text-black font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] transition-transform"
                   >
                      {isSaving ? <Loader2 className="animate-spin" size={16} /> : <><CheckCircle size={16} /> Save & Sync</>}
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MapTrackingScreen;
