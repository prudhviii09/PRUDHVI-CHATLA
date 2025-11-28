import React from 'react';

interface VoiceOrbProps {
  isActive: boolean;
  isListening: boolean;
  isLoading: boolean;
}

const VoiceOrb: React.FC<VoiceOrbProps> = ({ isActive, isListening, isLoading }) => {
  return (
    <div className={`relative flex items-center justify-center transition-all duration-700 ${isActive ? 'h-32 w-32' : 'h-16 w-16'}`}>
      {/* Core */}
      <div className={`absolute rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 z-10 transition-all duration-500 ${
        isActive ? 'h-24 w-24 blur-sm' : 'h-12 w-12 blur-md'
      } ${isLoading ? 'animate-pulse' : ''}`} />
      
      {/* Outer Glow 1 */}
      <div className={`absolute rounded-full bg-blue-600 mix-blend-screen opacity-50 blur-xl transition-all duration-1000 ${
        isActive ? 'h-32 w-32 animate-spin-slow' : 'h-14 w-14'
      } ${isListening ? 'scale-150 opacity-80' : ''}`} />

      {/* Outer Glow 2 */}
      <div className={`absolute rounded-full bg-pink-600 mix-blend-screen opacity-50 blur-xl transition-all duration-700 delay-75 ${
        isActive ? 'h-28 w-28 animate-pulse-slow' : 'h-14 w-14'
      } ${isListening ? 'scale-125' : ''}`} />
      
      {/* Particles/Details */}
      {isActive && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
           <div className="w-full h-full rounded-full border border-white/20 animate-ping opacity-20" />
        </div>
      )}
    </div>
  );
};

export default VoiceOrb;
