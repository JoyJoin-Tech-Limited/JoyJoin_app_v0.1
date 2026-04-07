import { useEffect, useState } from "react";
import joyJoinLogo from "@/assets/JoyJoinapp_logo_chi_ZhanKuQingKeHuangYouTi.png";

// Import archetype PNG assets
import 开心柯基 from "@/assets/开心柯基_transparent_1.png";
import 机智狐 from "@/assets/机智狐_transparent_2.png";
import 暖心熊 from "@/assets/暖心熊_transparent_3.png";
import 织网蛛 from "@/assets/织网蛛_transparent_4.png";
import 夸夸豚 from "@/assets/夸夸豚_transparent_5.png";
import 太阳鸡 from "@/assets/太阳鸡_transparent_6.png";
import 淡定海豚 from "@/assets/淡定海豚_transparent_7.png";
import 沉思猫头鹰 from "@/assets/沉思猫头鹰_transparent_8.png";
import 稳如龟 from "@/assets/稳如龟_transparent_9.png";
import 隐身猫 from "@/assets/隐身猫_transparent_10.png";
import 定心大象 from "@/assets/定心大象_transparent_11.png";
import 灵感章鱼 from "@/assets/灵感章鱼_transparent_12.png";

// Archetype name to asset path mapping (12 archetypes)
const ARCHETYPE_ASSETS: Record<string, string> = {
  "开心柯基": 开心柯基,
  "机智狐": 机智狐,
  "暖心熊": 暖心熊,
  "织网蛛": 织网蛛,
  "夸夸豚": 夸夸豚,
  "太阳鸡": 太阳鸡,
  "淡定海豚": 淡定海豚,
  "沉思猫头鹰": 沉思猫头鹰,
  "稳如龟": 稳如龟,
  "隐身猫": 隐身猫,
  "定心大象": 定心大象,
  "灵感章鱼": 灵感章鱼,
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
