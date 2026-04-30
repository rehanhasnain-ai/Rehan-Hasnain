import { motion } from "motion/react";

interface VoiceOrbProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
}

export default function VoiceOrb({ state }: VoiceOrbProps) {
  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      {/* Outer Glows */}
      <motion.div
        animate={{
          scale: state === 'listening' ? [1, 1.2, 1] : state === 'speaking' ? [1, 1.1, 1] : 1,
          opacity: state === 'idle' ? 0.1 : 0.3,
        }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute inset-0 orb-pulse rounded-full"
      />
      
      <motion.div
        animate={{
          scale: state === 'listening' ? [1, 1.4, 1] : state === 'thinking' ? [1, 1.2, 1] : 1,
          opacity: state === 'idle' ? 0.05 : 0.15,
        }}
        transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
        className="absolute inset-0 orb-pulse rounded-full"
      />

      {/* Main Orb */}
      <motion.div
        animate={
          state === 'listening' 
            ? { scale: [1, 1.05, 1], opacity: 1 } 
            : state === 'thinking' 
            ? { rotate: 360 } 
            : state === 'speaking'
            ? { scale: [1, 1.02, 1] }
            : { scale: 1, opacity: 0.8 }
        }
        transition={{
          scale: { duration: 1, repeat: Infinity },
          rotate: { duration: 4, repeat: Infinity, ease: "linear" }
        }}
        className="relative w-32 h-32 rounded-full border border-neon-green/30 bg-gradient-to-br from-neon-green/20 to-transparent backdrop-blur-3xl shadow-[inset_0_0_20px_rgba(34,197,94,0.3)] flex items-center justify-center overflow-hidden"
      >
        {/* Internal Core */}
        <motion.div 
          animate={state === 'thinking' ? { opacity: [0.3, 0.8, 0.3] } : { opacity: 0.5 }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-16 h-16 rounded-full bg-neon-green/40 blur-xl"
        />
        
        {/* Dynamic Wave (Simplified for CSS) */}
        {state === 'speaking' && (
          <motion.div 
            animate={{ y: [-5, 5, -5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-gradient-to-t from-neon-green/10 to-transparent"
          />
        )}
      </motion.div>

      {/* Decorative Rings */}
      <div className="absolute inset-0 rounded-full border border-white/5" />
      <div 
        style={{ width: '97px', height: '202px' }}
        className="absolute inset-4 rounded-full border border-white/5" 
      />
    </div>
  );
}
