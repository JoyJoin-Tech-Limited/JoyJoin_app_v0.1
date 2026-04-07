import { motion, useReducedMotion } from "framer-motion";
import { archetypeAvatars, archetypeGradients } from "@/lib/archetypeAvatars";

interface ConnectionArchetypeRevealProps {
  currentUserArchetype?: string | null;
  peerArchetype?: string | null;
}

function ArchetypeBubble({
  archetype,
  align,
}: {
  archetype?: string | null;
  align: "left" | "right";
}) {
  const avatar = archetype ? archetypeAvatars[archetype] : null;
  const gradient =
    (archetype && archetypeGradients[archetype]) || "from-violet-500 to-fuchsia-500";

  return (
    <motion.div
      initial={{ x: align === "left" ? -72 : 72, opacity: 0, scale: 0.8 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={`h-20 w-20 rounded-full bg-gradient-to-br ${gradient} p-1 shadow-[0_12px_40px_rgba(139,92,246,0.35)]`}
    >
      <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0E0B19]">
        {avatar ? (
          <img src={avatar} alt={archetype ?? "人格原型"} className="h-14 w-14 object-contain" />
        ) : (
          <span className="text-2xl">✨</span>
        )}
      </div>
    </motion.div>
  );
}

export default function ConnectionArchetypeReveal({
  currentUserArchetype,
  peerArchetype,
}: ConnectionArchetypeRevealProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative flex items-center justify-center gap-4 py-4">
      <ArchetypeBubble archetype={currentUserArchetype} align="left" />

      <motion.div
        initial={prefersReducedMotion ? false : { scale: 0.75, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.28, delay: 0.1 }}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/12 text-xl text-white ring-1 ring-white/20"
      >
        💜
        {!prefersReducedMotion && (
          <motion.div
            className="absolute inset-0 rounded-full border border-white/40"
            animate={{ scale: [1, 1.5], opacity: [0.55, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeOut" }}
          />
        )}
      </motion.div>

      <ArchetypeBubble archetype={peerArchetype} align="right" />
    </div>
  );
}
