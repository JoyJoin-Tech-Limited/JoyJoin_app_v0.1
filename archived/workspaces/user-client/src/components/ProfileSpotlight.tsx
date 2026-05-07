import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { Sparkles, Briefcase, Heart, MessageCircle } from "lucide-react";
import { archetypeAvatars, archetypeGradients } from "@/lib/archetypeAvatars";
import { archetypeConfig } from "@/lib/archetypes";

interface ProfileSpotlightProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    userId: string;
    displayName: string;
    archetype?: string;
    topInterests?: string[];
    ageRange?: string;
    industry?: string;
    ageVisible?: boolean;
    industryVisible?: boolean;
  };
  compatibility?: number;
}

export default function ProfileSpotlight({ open, onOpenChange, user, compatibility }: ProfileSpotlightProps) {
  const archetype = user.archetype || '';
  const avatar = archetype ? archetypeAvatars[archetype] : null;
  const gradient = archetype ? archetypeGradients[archetype] : 'from-purple-500 to-pink-500';
  const config = archetype ? archetypeConfig[archetype] : null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent 
        className="max-h-[85vh] rounded-t-3xl"
        data-testid="profile-spotlight-drawer"
      >
        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mb-4 mt-2" />
        
        <DrawerHeader className="text-center pb-2">
          <DrawerTitle className="sr-only">用户画像</DrawerTitle>
        </DrawerHeader>

        <div className="px-6 pb-8 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <div className={`relative w-24 h-24 rounded-full bg-gradient-to-br ${gradient} p-1 shadow-lg`}>
              <Avatar className="w-full h-full">
                {avatar ? <AvatarImage src={avatar} /> : null}
                <AvatarFallback className="text-2xl bg-white dark:bg-gray-800">
                  {user.displayName?.slice(0, 1) || '?'}
                </AvatarFallback>
              </Avatar>
              
              {compatibility && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 flex items-center justify-center text-white text-xs font-bold shadow-lg"
                >
                  {compatibility}%
                </motion.div>
              )}
            </div>

            <h3 className="mt-4 text-xl font-bold">{user.displayName}</h3>
            
            {archetype && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-2 mt-2"
              >
                <Badge className={`bg-gradient-to-r ${gradient} text-white`}>
                  <Sparkles className="w-3 h-3 mr-1" />
                  {archetype}
                </Badge>
              </motion.div>
            )}

            {config?.tagline && (
              <p className="text-sm text-muted-foreground mt-2 italic">
                "{config.tagline}"
              </p>
            )}
          </motion.div>

          <div className="grid grid-cols-2 gap-3">
            {user.ageVisible !== false && user.ageRange && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-muted/50 rounded-xl p-3"
              >
                <p className="text-xs text-muted-foreground mb-1">年龄</p>
                <p className="font-medium">{user.ageRange}岁</p>
              </motion.div>
            )}

            {user.industryVisible !== false && user.industry && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-muted/50 rounded-xl p-3"
              >
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <Briefcase className="w-3 h-3" />
                  行业
                </div>
                <p className="font-medium text-sm">{user.industry}</p>
              </motion.div>
            )}
          </div>

          {user.topInterests && user.topInterests.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-pink-500" />
                <span className="text-sm font-medium">兴趣标签</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {user.topInterests.map((interest, idx) => (
                  <motion.div
                    key={interest}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + idx * 0.05 }}
                  >
                    <Badge variant="secondary" className="text-xs">
                      {interest}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {config?.epicDescription && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Ta的社交风格</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {config.epicDescription}
              </p>
            </motion.div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
