import React from 'react';
import { motion } from 'framer-motion';

interface GlowingButtonProps {
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export default function GlowingButton({ onClick, children, className = '', disabled = false }: GlowingButtonProps) {
  return (
    <motion.button
      onClick={(e) => onClick?.(e as any)}
      disabled={disabled}
      className={`bg-[#121212] text-[#CCFF00] border border-[#CCFF00]/50 px-6 py-3 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      initial={{ 
        boxShadow: "0px 0px 0px 0px rgba(206, 242, 69, 0)" 
      }}
      whileHover={!disabled ? { 
        boxShadow: "0px 0px 20px 0px rgba(206, 242, 69, 0.4)",
        borderColor: "rgba(206, 242, 69, 0.8)"
      } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {children || 'INITIALIZE PROTOCOL'}
    </motion.button>
  );
}
