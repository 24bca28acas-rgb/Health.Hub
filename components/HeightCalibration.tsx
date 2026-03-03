
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ruler, MapPin, Footprints, AlertTriangle, Play, Square, Save, CheckCircle, Navigation as NavIcon, Loader2, ExternalLink } from 'lucide-react';
import usePedometer from '../hooks/usePedometer';
import { getCalibrationInsight, MapInsight } from '../services/geminiService';

// Fix: Declare google as a global variable to satisfy TypeScript and allow access to the Google Maps API.
declare var google: any;

interface HeightCalibrationProps {
  onSaveHeight: (height: number) => void;
}

const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#181818" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#121212" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] }
];

const HeightCalibration: React.FC<HeightCalibrationProps> = ({ onSaveHeight }) => {
  const { isTracking, toggleTracking, liveSteps, resetLiveSteps } = usePedometer();
  
  const [distance, setDistance] = useState(0); 
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [lastCoord, setLastCoord] = useState<GeolocationCoordinates | null>(null);
  const [path, setPath] = useState<{lat: number, lng: number}[]>([]);
  const [estimatedHeight, setEstimatedHeight] = useState<number | null>(null);
  const [aiInsight, setAiInsight] = useState<MapInsight | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  // Fix: Use any type for Google Maps references as the namespace isn't pre-loaded in TypeScript.
  const googleMap = useRef<any>(null);
  const polyline = useRef<any>(null);
  const watchId = useRef<number | null>(null);

  // Initialize Map
  useEffect(() => {
    const loadMap = () => {
      // Fix: Access window.google as any to check for existence without TypeScript errors.
      if (!(window as any).google) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.API_KEY}&libraries=geometry`;
        script.async = true;
        script.defer = true;
        script.onload = () => setMapLoaded(true);
        document.head.appendChild(script);
      } else {
        setMapLoaded(true);
      }
    };
    loadMap();
  }, []);

  useEffect(() => {
    if (mapLoaded && mapRef.current && !googleMap.current) {
      // Fix: google is now declared as a global.
      googleMap.current = new google.maps.Map(mapRef.current, {
        center: { lat: 0, lng: 0 },
        zoom: 18,
        styles: mapStyles,
        disableDefaultUI: true,
        gestureHandling: "none"
      });

      polyline.current = new google.maps.Polyline({
        path: [],
        geodesic: true,
        strokeColor: "#CEF245",
        strokeOpacity: 1.0,
        strokeWeight: 4,
        map: googleMap.current
      });
    }
  }, [mapLoaded]);

  // Height Calculation Logic
  useEffect(() => {
    if (liveSteps > 10 && distance > 5) {
      const strideLength = distance / liveSteps;
      const h = (strideLength / 0.414) * 100;
      setEstimatedHeight(Number(h.toFixed(1)));
    }
  }, [liveSteps, distance]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    // Fix: Cast window to any for safe property access.
    if (!(window as any).google) return 0;
    const p1 = new google.maps.LatLng(lat1, lon1);
    const p2 = new google.maps.LatLng(lat2, lon2);
    return google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
  };

  const startCalibration = async () => {
    resetLiveSteps();
    setDistance(0);
    setPath([]);
    setEstimatedHeight(null);
    setIsCalibrating(true);
    
    if (!isTracking) await toggleTracking();

    if ("geolocation" in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          const newPos = { lat: position.coords.latitude, lng: position.coords.longitude };
          
          if (lastCoord) {
            const d = calculateDistance(
              lastCoord.latitude,
              lastCoord.longitude,
              newPos.lat,
              newPos.lng
            );
            if (d > 0.5) {
              setDistance((prev) => prev + d);
            }
          } else {
            // First fix
            getCalibrationInsight(newPos.lat, newPos.lng)
                .then(setAiInsight)
                .catch(console.error);
          }

          setLastCoord(position.coords);
          setPath(prev => [...prev, newPos]);
          
          if (googleMap.current) {
            googleMap.current.setCenter(newPos);
            polyline.current?.setPath([...path, newPos]);
          }
        },
        (error) => console.error(error),
        { enableHighAccuracy: true }
      );
    }
  };

  const stopCalibration = async () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (isTracking) await toggleTracking();
    setIsCalibrating(false);
    setLastCoord(null);
  };

  const handleSave = async () => {
    if (!estimatedHeight) return;
    setIsSaving(true);
    try {
        await onSaveHeight(estimatedHeight);
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="min-h-full w-full bg-black p-8 pb-32 flex flex-col gap-8 overflow-y-auto no-scrollbar">
      <div className="text-center">
        <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-2">Biometric Calibration</h2>
        <h1 className="text-4xl font-black text-white tracking-tighter">HEIGHT <span className="text-luxury-neon">WALK</span></h1>
      </div>

      {/* Visual Map Container */}
      <div className="relative w-full aspect-square max-w-sm mx-auto rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl">
         <div ref={mapRef} className="w-full h-full bg-zinc-900" />
         {!isCalibrating && !path.length && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
                <NavIcon size={40} className="text-luxury-neon mb-4 animate-pulse" />
                <p className="text-xs font-bold text-white uppercase tracking-widest">Protocol Ready</p>
                <p className="text-[10px] text-gray-500 mt-2">Walk 100m in a straight line for elite precision.</p>
            </div>
         )}
         {isCalibrating && (
             <div className="absolute top-6 left-6 right-6 flex justify-between">
                <div className="px-4 py-2 bg-black/80 backdrop-blur-md rounded-full border border-luxury-neon/30 flex items-center gap-2">
                    <div className="w-2 h-2 bg-luxury-neon rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">Live Tracking</span>
                </div>
             </div>
         )}
      </div>

      {/* Main Stats Area */}
      <div className="flex flex-col items-center justify-center relative">
          <div className="flex flex-col items-center text-center">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Estimated Height</p>
            <div className="flex items-baseline gap-1">
                <span className="text-6xl font-black text-white tracking-tighter">
                    {estimatedHeight || "--"}
                </span>
                <span className="text-sm font-black text-luxury-neon uppercase tracking-widest">CM</span>
            </div>
          </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-6 rounded-[2.5rem] border border-white/5 flex flex-col items-center gap-2">
            <Footprints className="text-luxury-neon" size={20} />
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Steps</span>
            <span className="text-2xl font-black text-white">{liveSteps}</span>
        </div>
        <div className="glass-card p-6 rounded-[2.5rem] border border-white/5 flex flex-col items-center gap-2">
            <MapPin className="text-luxury-gold" size={20} />
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Distance</span>
            <span className="text-2xl font-black text-white">{Math.floor(distance)}<span className="text-xs ml-1">M</span></span>
        </div>
      </div>

      <AnimatePresence>
        {aiInsight && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="glass-card bg-luxury-neon/5 border border-luxury-neon/10 rounded-3xl p-6">
                <p className="italic text-[11px] text-gray-400 text-center leading-relaxed mb-4">
                  "{aiInsight.text}"
                </p>
                {aiInsight.sources.length > 0 && (
                  <div className="pt-4 border-t border-white/5">
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-3">Landmark Sources</p>
                    <div className="flex flex-wrap gap-2">
                        {aiInsight.sources.map((source, i) => (
                           <a 
                             key={i} 
                             href={source.uri} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-full text-[9px] font-bold text-luxury-neon border border-luxury-neon/20 hover:bg-luxury-neon/10 transition-colors"
                           >
                              <ExternalLink size={10} /> {source.title}
                           </a>
                        ))}
                    </div>
                  </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="flex flex-col gap-4">
        {!isCalibrating ? (
           <button 
             onClick={startCalibration}
             className="w-full py-6 bg-white text-black font-black uppercase tracking-[0.2em] rounded-[2rem] flex items-center justify-center gap-3 shadow-2xl hover:scale-[1.02] transition-all"
           >
              <Play size={20} fill="black" /> Start Calibration
           </button>
        ) : (
           <button 
             onClick={stopCalibration}
             className="w-full py-6 bg-red-600 text-white font-black uppercase tracking-[0.2em] rounded-[2rem] flex items-center justify-center gap-3 shadow-2xl animate-pulse"
           >
              <Square size={20} fill="white" /> Stop Session
           </button>
        )}

        <button 
          onClick={handleSave}
          disabled={!estimatedHeight || distance < 50 || isCalibrating || isSaving}
          className="w-full py-6 bg-luxury-neon text-black font-black uppercase tracking-[0.2em] rounded-[2rem] flex items-center justify-center gap-3 shadow-2xl disabled:opacity-20 transition-all"
        >
           {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={20} /> Save Height Protocol</>}
        </button>
      </div>
    </div>
  );
};

export default HeightCalibration;
