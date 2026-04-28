import { useEffect, useState } from "react";
import joyJoinLogo from "@/assets/JoyJoinapp_logo_chi_ZhanKuQingKeHuangYouTi.png";

// Import archetype PNG assets
import corgi from "@/assets/corgi_transparent_1.png";
import fox from "@/assets/fox_transparent_2.png";
import koala from "@/assets/koala_transparent_3.png";
import spider from "@/assets/spider_transparent_4.png";
import hamster_praise from "@/assets/hamster_praise_transparent_5.png";
import rooster from "@/assets/rooster_transparent_6.png";
import dolphin_calm from "@/assets/dolphin_calm_transparent_7.png";
import owl from "@/assets/owl_transparent_8.png";
import turtle from "@/assets/turtle_transparent_9.png";
import cat from "@/assets/cat_transparent_10.png";
import elephant from "@/assets/elephant_transparent_11.png";
import octopus from "@/assets/octopus_transparent_12.png";

// Archetype name to asset path mapping (12 archetypes)
const ARCHETYPE_ASSETS: Record<string, string> = {
  "corgi": corgi,
  "fox": fox,
  "koala": koala,
  "spider": spider,
  "hamster_praise": hamster_praise,
  "rooster": rooster,
  "dolphin_calm": dolphin_calm,
  "owl": owl,
  "turtle": turtle,
  "cat": cat,
  "elephant": elephant,
  "octopus": octopus,
};

// Get archetype asset path with fallback
function getArchetypeAsset(archetypeName?: string): string | null {
  if (!archetypeName) return null;
  
  // Try exact match first
  if (ARCHETYPE_ASSETS[archetypeName]) {
    return ARCHETYPE_ASSETS[archetypeName];
  }
  
  // Try partial match (case-insensitive)
  const lowerName = archetypeName.toLowerCase();
  const match = Object.keys(ARCHETYPE_ASSETS).find(key => 
    key.toLowerCase().includes(lowerName) || lowerName.includes(key.toLowerCase())
  );
  
  return match ? ARCHETYPE_ASSETS[match] : null;
}

interface ArchetypeOrbitProps {
  archetypes?: string[];
  size?: "small" | "medium" | "large";
  animated?: boolean;
  onAnimationComplete?: () => void;
}

export default function ArchetypeOrbit({ 
  archetypes = [], 
  size = "medium",
  animated = true,
  onAnimationComplete,
}: ArchetypeOrbitProps) {
  const [showLogo, setShowLogo] = useState(!animated);
  const [showOrbiters, setShowOrbiters] = useState(!animated);
  
  // Size configurations
  const sizeConfig = {
    small: {
      container: "h-40",
      logo: "h-16 w-16",
      orbiter: "h-10 w-10",
      orbitRadius: 60,
    },
    medium: {
      container: "h-56",
      logo: "h-24 w-24",
      orbiter: "h-14 w-14",
      orbitRadius: 90,
    },
    large: {
      container: "h-72",
      logo: "h-32 w-32",
      orbiter: "h-16 w-16",
      orbitRadius: 110,
    },
  };
  
  const config = sizeConfig[size];
  
  // Filter archetypes to valid ones and limit to 6
  const validArchetypes = archetypes
    .map(name => ({ name, asset: getArchetypeAsset(name) }))
    .filter(item => item.asset !== null)
    .slice(0, 6);
  
  // Animation sequence
  useEffect(() => {
    // Reset states when animated prop changes
    if (animated) {
      setShowLogo(false);
      setShowOrbiters(false);
    } else {
      setShowLogo(true);
      setShowOrbiters(true);
      return; // No animation or callback in static mode
    }
    
    // Step A: Logo wake-up (0.5s)
    const logoTimer = setTimeout(() => {
      setShowLogo(true);
    }, 100);
    
    // Step B: Archetype orbiters fly in (0.8s after logo)
    const orbiterTimer = setTimeout(() => {
      setShowOrbiters(true);
    }, 800);
    
    // Step C: Complete animation (1.5s after orbiters start)
    const completeTimer = setTimeout(() => {
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    }, 2300);
    
    return () => {
      clearTimeout(logoTimer);
      clearTimeout(orbiterTimer);
      clearTimeout(completeTimer);
    };
  }, [animated, onAnimationComplete]);
  
  return (
    <div className={`relative ${config.container} flex items-center justify-center`}>
      {/* Center logo */}
      <div 
        className={`relative z-10 transition-all duration-500 ${
          showLogo ? "opacity-100 scale-100" : "opacity-0 scale-75"
        }`}
        style={{
          animation: showLogo && animated ? "logoWakeUp 0.5s ease-out" : undefined,
        }}
      >
        <img 
          src={joyJoinLogo} 
          alt="JoyJoin" 
          className={`${config.logo} object-contain drop-shadow-lg`}
        />
      </div>
      
      {/* Orbiting archetype PNGs */}
      {validArchetypes.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          {validArchetypes.map((item, idx) => {
            const angle = (360 / validArchetypes.length) * idx;
            const delay = idx * 0.1;
            
            return (
              <div
                key={`${item.name}-${idx}`}
                className={`absolute transition-all duration-700 ${
                  showOrbiters ? "opacity-100" : "opacity-0"
                }`}
                style={{
                  transform: `rotate(${angle}deg) translateY(-${config.orbitRadius}px)`,
                  transitionDelay: showOrbiters && animated ? `${delay}s` : "0s",
                  animation: showOrbiters && animated 
                    ? `flyIn 0.6s ease-out ${delay}s both` 
                    : undefined,
                }}
              >
                <div 
                  style={{ transform: `rotate(-${angle}deg)` }}
                  className="relative"
                >
                  <img 
                    src={item.asset!} 
                    alt={item.name} 
                    className={`${config.orbiter} object-contain drop-shadow-md`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* CSS animations */}
      <style>{`
        @keyframes logoWakeUp {
          0% {
            opacity: 0;
            transform: scale(0.75) translateY(10px);
          }
          60% {
            transform: scale(1.05) translateY(0);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        @keyframes flyIn {
          0% {
            opacity: 0;
            transform: scale(0) translateY(-20px);
          }
          60% {
            transform: scale(1.1) translateY(0);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
