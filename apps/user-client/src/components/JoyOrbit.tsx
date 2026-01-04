import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { archetypeAvatars, archetypeGradients } from "@/lib/archetypeAvatars";
import { useState } from "react";
import ProfileSpotlight from "./ProfileSpotlight";

interface OrbitMember {
  userId: string;
  displayName: string;
  archetype?: string;
  topInterests?: string[];
  age?: number;
  industry?: string;
  ageVisible?: boolean;
  industryVisible?: boolean;
}

interface JoyOrbitProps {
  members: OrbitMember[];
  centerLabel?: string;
  className?: string;
}

export default function JoyOrbit({ members, centerLabel = "本桌", className = "" }: JoyOrbitProps) {
  const [selectedMember, setSelectedMember] = useState<OrbitMember | null>(null);
  const [rotation, setRotation] = useState(0);

  const orbitRadius = 100;
  const memberCount = members.length;

  const handleDrag = (_: any, info: { offset: { x: number } }) => {
    setRotation(prev => prev + info.offset.x * 0.5);
  };

  return (
    <div 
      className={`relative w-full aspect-square max-w-[300px] mx-auto ${className}`}
      data-testid="joy-orbit"
    >
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-dashed border-primary/20"
        style={{ margin: '20%' }}
      />
      
      <motion.div
        className="absolute inset-0 rounded-full border border-primary/10"
        style={{ margin: '10%' }}
      />

      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center z-10"
        animate={{
          boxShadow: [
            '0 0 20px rgba(168, 85, 247, 0.3)',
            '0 0 40px rgba(168, 85, 247, 0.5)',
            '0 0 20px rgba(168, 85, 247, 0.3)',
          ],
        }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        <span className="text-xs font-medium text-primary">{centerLabel}</span>
      </motion.div>

      <motion.div
        className="absolute inset-0"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0}
        onDrag={handleDrag}
        style={{ cursor: 'grab' }}
        whileDrag={{ cursor: 'grabbing' }}
      >
        {members.map((member, idx) => {
          const angle = (360 / memberCount) * idx + rotation;
          const radian = (angle * Math.PI) / 180;
          const x = Math.cos(radian) * orbitRadius;
          const y = Math.sin(radian) * orbitRadius;
          
          const gradient = member.archetype ? archetypeGradients[member.archetype] : 'from-purple-500 to-pink-500';
          const avatar = member.archetype ? archetypeAvatars[member.archetype] : null;

          return (
            <motion.div
              key={member.userId}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                x,
                y,
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1, type: "spring" }}
            >
              <motion.button
                className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} p-0.5 shadow-lg`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedMember(member)}
                data-testid={`orbit-member-${member.userId}`}
              >
                <Avatar className="w-full h-full">
                  {avatar ? <AvatarImage src={avatar} /> : null}
                  <AvatarFallback className="bg-white dark:bg-gray-800 text-xs">
                    {member.displayName?.slice(0, 1) || '?'}
                  </AvatarFallback>
                </Avatar>
              </motion.button>
              
              <motion.div
                className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.1 + 0.2 }}
              >
                <span className="text-[10px] text-muted-foreground">
                  {member.displayName?.slice(0, 4)}
                </span>
              </motion.div>
            </motion.div>
          );
        })}
      </motion.div>

      {members.map((member, idx) => {
        const nextIdx = (idx + 1) % memberCount;
        const angle1 = (360 / memberCount) * idx + rotation;
        const angle2 = (360 / memberCount) * nextIdx + rotation;
        
        return (
          <motion.div
            key={`spark-${idx}`}
            className="absolute left-1/2 top-1/2 w-1 h-1 rounded-full bg-primary/50"
            animate={{
              x: [
                Math.cos((angle1 * Math.PI) / 180) * orbitRadius,
                Math.cos((angle2 * Math.PI) / 180) * orbitRadius,
              ],
              y: [
                Math.sin((angle1 * Math.PI) / 180) * orbitRadius,
                Math.sin((angle2 * Math.PI) / 180) * orbitRadius,
              ],
              opacity: [0, 1, 0],
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              delay: idx * 0.3,
            }}
          />
        );
      })}

      <ProfileSpotlight
        open={!!selectedMember}
        onOpenChange={(open) => !open && setSelectedMember(null)}
        user={selectedMember || { userId: '', displayName: '' }}
      />
    </div>
  );
}
