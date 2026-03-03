import React, { useState } from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = "w-32 h-32" }) => {
  // Updated to point to your specific app-assets bucket
  const logoUrl = 'https://tngzcpgoshpfwuarskul.supabase.co/storage/v1/object/public/app-assets/logo.png';
  const [error, setError] = useState(false);

  // Fallback text if the image fails to load
  if (error) {
    return (
      <div className={`${className} flex items-center justify-center border border-white/10 rounded-xl bg-white/5`}>
        <span className="text-luxury-neon font-black text-xl tracking-tighter drop-shadow-[0_0_8px_rgba(206,242,69,0.5)]">H-FIT</span>
      </div>
    );
  }

  return (
    <img 
      src={logoUrl} 
      alt="Healthy.Hub Logo" 
      className={`${className} object-contain drop-shadow-[0_0_15px_rgba(206,242,69,0.3)]`}
      onError={() => setError(true)}
    />
  );
};

export default Logo;