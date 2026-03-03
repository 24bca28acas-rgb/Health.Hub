import React from 'react';
import { motion } from 'framer-motion';

const DashboardSkeleton: React.FC = () => {
  return (
    <div className="h-full w-full flex flex-col p-6 pt-12 space-y-6 pb-24 relative overflow-hidden">
      
      {/* Header Skeleton */}
      <div className="flex justify-between items-center z-10">
        <div className="space-y-2">
          <div className="h-3 w-32 skeleton-shimmer rounded-full"></div>
          <div className="h-8 w-48 skeleton-shimmer rounded-lg"></div>
        </div>
        <div className="h-10 w-10 skeleton-shimmer rounded-full"></div>
      </div>
      
      {/* Streak Widget Skeleton */}
      <div className="w-full h-24 skeleton-shimmer rounded-2xl relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-4 opacity-50">
             <div className="h-10 w-10 bg-black/20 rounded-full"></div>
             <div className="h-6 w-20 bg-black/20 rounded-md"></div>
          </div>
      </div>

      {/* Tracking Button Skeleton */}
      <div className="w-full h-16 skeleton-shimmer rounded-2xl"></div>

      {/* Rings Skeleton */}
      <div className="relative w-full h-72 flex items-center justify-center glass-panel rounded-3xl overflow-hidden shrink-0 border border-white/5">
         <div className="w-48 h-48 rounded-full border-8 border-white/5 flex items-center justify-center">
             <div className="w-32 h-32 rounded-full border-8 border-white/5"></div>
         </div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-2 gap-4 shrink-0">
        <div className="glass-panel p-4 rounded-2xl h-32 flex flex-col justify-between">
           <div className="flex justify-between">
               <div className="w-6 h-6 skeleton-shimmer rounded-md"></div>
               <div className="w-10 h-3 skeleton-shimmer rounded-full"></div>
           </div>
           <div className="space-y-2">
               <div className="w-24 h-8 skeleton-shimmer rounded-lg"></div>
               <div className="w-16 h-3 skeleton-shimmer rounded-full"></div>
           </div>
        </div>
        <div className="glass-panel p-4 rounded-2xl h-32 flex flex-col justify-between">
           <div className="flex justify-between">
               <div className="w-6 h-6 skeleton-shimmer rounded-md"></div>
               <div className="w-10 h-3 skeleton-shimmer rounded-full"></div>
           </div>
           <div className="space-y-2">
               <div className="w-24 h-8 skeleton-shimmer rounded-lg"></div>
               <div className="w-16 h-3 skeleton-shimmer rounded-full"></div>
           </div>
        </div>
      </div>

      {/* Chart Skeleton */}
      <div className="glass-panel p-4 rounded-3xl flex-1 flex flex-col">
         <div className="h-3 w-24 skeleton-shimmer rounded-full mb-4"></div>
         <div className="flex-1 flex items-end gap-2 justify-between px-2">
             {[...Array(7)].map((_, i) => (
                 <div key={i} className="w-full skeleton-shimmer rounded-t-md" style={{ height: `${Math.random() * 60 + 20}%` }}></div>
             ))}
         </div>
      </div>

    </div>
  );
};

export default DashboardSkeleton;