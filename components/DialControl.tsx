
import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

interface DialControlProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  label: string;
  unit: string;
  color?: string;
}

const DialControl: React.FC<DialControlProps> = ({ value, min, max, step, onChange, label, unit }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // --- CONFIGURATION ---
  const size = 260;
  const strokeWidth = 12; // Active Track Width
  const backgroundTrackWidth = 6; // Passive Track Width
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  
  // Angles (Speedometer Style: 135° start to 405° end)
  const startAngle = 135;
  const endAngle = 405;
  const totalAngle = endAngle - startAngle;

  // --- ANIMATION STATE ---
  const motionValue = useMotionValue(value);
  const displayValue = useTransform(motionValue, (v) => Math.round(v));

  // Sync motion value with prop changes (smooth animation)
  useEffect(() => {
    if (!isDragging) {
      animate(motionValue, value, {
        type: "spring",
        damping: 20,
        stiffness: 100
      });
    }
  }, [value, isDragging, motionValue]);

  // --- GEOMETRY HELPERS ---

  // Convert logical value to degrees
  const valueToAngle = (v: number) => {
    const clamped = Math.min(Math.max(v, min), max);
    const percentage = (clamped - min) / (max - min);
    return startAngle + (percentage * totalAngle);
  };

  // Convert angle (degrees) to Cartesian coordinates (x, y)
  const angleToPoint = (angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * (Math.PI / 180);
    return {
      x: center + radius * Math.cos(angleInRadians),
      y: center + radius * Math.sin(angleInRadians)
    };
  };

  // Generate SVG Path for an Arc
  const describeArc = (start: number, end: number) => {
    const startPt = angleToPoint(start);
    const endPt = angleToPoint(end);
    
    // Determine if the arc should be drawn as the "large" arc flag (more than 180 degrees)
    const largeArcFlag = end - start <= 180 ? "0" : "1";

    return [
      "M", startPt.x, startPt.y,
      "A", radius, radius, 0, largeArcFlag, 1, endPt.x, endPt.y
    ].join(" ");
  };

  // --- INTERACTION LOGIC ---

  const handleInteraction = (clientX: number, clientY: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    
    // Calculate angle relative to 12 o'clock (0 degrees)
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    // Logic to map the 360 circle to our 135-405 range
    // We want the gap at the bottom to be a "dead zone" or snap to closest
    // 135 is bottom left, 225 is bottom center, 315 is bottom right (wait, math check)
    // Visual:
    // Top = 0 (relative to atan calculation offset)
    // Right = 90
    // Bottom = 180
    // Left = 270
    
    // Our Dial:
    // Start: 135 (Bottom Left)
    // End: 405 (Bottom Right, which is 45 mod 360)
    
    // Adjusted Input Angle logic:
    // If angle is in the gap (e.g. 45 to 135 area), clamp it.
    
    // Let's shift everything so Start is 0 for easier calc
    let effectiveAngle = angle - startAngle;
    if (effectiveAngle < 0) effectiveAngle += 360;

    // Clamping logic for the dead zone at the bottom
    if (effectiveAngle > totalAngle) {
       // It's in the gap. Snap to min or max based on which side is closer.
       const midGap = totalAngle + (360 - totalAngle) / 2;
       if (effectiveAngle < midGap) effectiveAngle = totalAngle; // Snap to max
       else effectiveAngle = 0; // Snap to min
    }

    const percentage = effectiveAngle / totalAngle;
    let newValue = min + percentage * (max - min);

    // Snap to step
    newValue = Math.round(newValue / step) * step;
    
    // Clamp constraints
    newValue = Math.min(Math.max(newValue, min), max);

    onChange(newValue);
    motionValue.set(newValue); // Immediate feedback while dragging
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    // @ts-ignore
    e.target.setPointerCapture(e.pointerId);
    handleInteraction(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      e.preventDefault();
      handleInteraction(e.clientX, e.clientY);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // @ts-ignore
    e.target.releasePointerCapture(e.pointerId);
  };

  // --- RENDER VARS ---
  const currentAngle = valueToAngle(value);
  const knobPos = angleToPoint(currentAngle);

  // Background Track Path
  const bgPath = describeArc(startAngle, endAngle);
  // Active Progress Path
  const progressPath = describeArc(startAngle, currentAngle);

  return (
    <div className="flex flex-col items-center justify-center p-6 select-none">
      <div className="relative" style={{ width: size, height: size }}>
        
        {/* Glow Effect Layer */}
        <div className="absolute inset-0 rounded-full bg-orange-500/5 blur-3xl"></div>

        <svg 
            ref={svgRef}
            width={size} 
            height={size} 
            viewBox={`0 0 ${size} ${size}`}
            className="cursor-pointer touch-none relative z-10"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
          <defs>
            {/* Professional Neon Gradient */}
            <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fbbf24" /> {/* Amber/Orange Light */}
              <stop offset="100%" stopColor="#ea580c" /> {/* Deep Orange */}
            </linearGradient>
            
            {/* Subtle Drop Shadow for 3D depth */}
            <filter id="trackShadow" x="-20%" y="-20%" width="140%" height="140%">
               <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5"/>
            </filter>
            
            {/* Knob Glow */}
            <filter id="knobGlow" x="-50%" y="-50%" width="200%" height="200%">
               <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
               <feMerge>
                   <feMergeNode in="coloredBlur"/>
                   <feMergeNode in="SourceGraphic"/>
               </feMerge>
            </filter>
          </defs>

          {/* 1. Background Track */}
          <path 
            d={bgPath}
            fill="none"
            stroke="#262626" // Neutral Dark Grey
            strokeWidth={backgroundTrackWidth}
            strokeLinecap="round"
          />

          {/* 2. Active Progress Bar (With Gradient & Glow) */}
          <path 
            d={progressPath}
            fill="none"
            stroke="url(#neonGradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 8px rgba(234, 88, 12, 0.4))" }}
          />

          {/* 3. The Knob (Calculated Position) */}
          <circle 
            cx={knobPos.x} 
            cy={knobPos.y} 
            r={10} 
            fill="#FFFFFF"
            stroke="#000000"
            strokeWidth={2}
            style={{ filter: "url(#knobGlow)" }}
          />
        </svg>

        {/* 4. Center Content (Absolute Positioned Overlay) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
            <DisplayText value={displayValue} />
            <span className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mt-1">{unit}</span>
        </div>
      </div>

      <p className="mt-4 text-[10px] font-black text-gray-600 uppercase tracking-[0.3em]">{label}</p>
    </div>
  );
};

// Optimization: Separate component for text to minimize re-renders of the heavy SVG
const DisplayText = ({ value }: { value: any }) => {
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const unsubscribe = value.on("change", (latest: number) => {
            if (ref.current) {
                ref.current.textContent = Math.round(latest).toLocaleString();
            }
        });
        return () => unsubscribe();
    }, [value]);

    return (
        <span ref={ref} className="text-5xl font-black text-white tracking-tighter drop-shadow-lg">
           0
        </span>
    );
};

export default DialControl;
