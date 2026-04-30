import { motion } from "motion/react";

interface VoiceWaveProps {
  isActive: boolean;
  color?: string;
  isThinking?: boolean;
}

export default function VoiceWave({ isActive, color = "bg-neon-green", isThinking }: VoiceWaveProps) {
  const bars = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div className="flex items-end justify-center gap-1 h-8">
      {bars.map((i) => (
        <motion.div
          key={i}
          className={`w-0.5 rounded-full ${color} shadow-[0_0_10px_rgba(34,197,94,0.5)]`}
          animate={
            isActive
              ? {
                  height: [4, 24, 12, 32, 8, 4],
                  opacity: [0.3, 1, 0.6, 1, 0.4, 0.3],
                }
              : isThinking
              ? {
                  scaleY: [1, 1.4, 1],
                  opacity: [0.2, 0.5, 0.2],
                }
              : {
                  height: 4,
                  opacity: 0.1,
                }
          }
          transition={{
            duration: isThinking ? 1.2 : 0.6,
            repeat: Infinity,
            delay: i * 0.08,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
