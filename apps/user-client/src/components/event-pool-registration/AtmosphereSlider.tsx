import * as Slider from "@radix-ui/react-slider";
import { motion, useReducedMotion } from "framer-motion";

export interface AtmosphereOption {
  value: string;
  label: string;
  priceLabel: string;
  mood: string;
  accentClass: string;
}

interface AtmosphereSliderProps {
  options: AtmosphereOption[];
  value?: string;
  onChange: (value: string) => void;
}

export default function AtmosphereSlider({
  options,
  value,
  onChange,
}: AtmosphereSliderProps) {
  const prefersReducedMotion = useReducedMotion();
  const currentIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const activeOption = options[currentIndex] ?? options[0];

  return (
    <div className="space-y-5">
      <div className={`rounded-[28px] bg-gradient-to-br ${activeOption.accentClass} p-[1px] shadow-lg`}>
        <div className="rounded-[27px] bg-background/95 px-5 py-5 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">今晚氛围</p>
          <motion.h3
            key={activeOption.value}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22 }}
            className="mt-2 text-2xl font-cn-display font-semibold text-foreground"
          >
            {activeOption.label}
          </motion.h3>
          <p className="mt-1 text-sm text-muted-foreground">{activeOption.mood}</p>
          <p className="mt-3 text-sm font-medium text-foreground">{activeOption.priceLabel}</p>
        </div>
      </div>

      <Slider.Root
        className="relative flex h-8 w-full touch-none select-none items-center"
        min={0}
        max={Math.max(options.length - 1, 0)}
        step={1}
        value={[currentIndex]}
        onValueChange={([nextIndex]) => onChange(options[nextIndex]?.value ?? options[0].value)}
      >
        <Slider.Track className="relative h-2 grow overflow-hidden rounded-full bg-muted">
          <Slider.Range className="absolute h-full bg-gradient-to-r from-primary to-violet-500" />
        </Slider.Track>
        <Slider.Thumb
          aria-label="选择氛围"
          className="block h-6 w-6 rounded-full border border-white bg-white shadow-lg ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </Slider.Root>

      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const isActive = option.value === activeOption.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                isActive
                  ? "border-primary bg-primary/8 shadow-sm"
                  : "border-border bg-background/70 hover:border-primary/40"
              }`}
            >
              <p className="text-sm font-medium text-foreground">{option.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{option.priceLabel}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
