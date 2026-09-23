import { useRef, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';
import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'framer-motion';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Spring-damped parallax tilt plus a cursor-reactive spotlight border, for
 * the bento grid. Cursor position drives motion values only, never state.
 */
export function TiltCard({ children, className }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const springConfig = { stiffness: 300, damping: 30 };
  const rotateX = useSpring(useTransform(mouseY, [0, 1], [7, -7]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [0, 1], [-7, 7]), springConfig);
  const spotlightX = useTransform(mouseX, (value) => `${value * 100}%`);
  const spotlightY = useTransform(mouseY, (value) => `${value * 100}%`);
  const spotlightBackground = useMotionTemplate`radial-gradient(180px circle at ${spotlightX} ${spotlightY}, hsl(var(--brand) / 0.16), transparent 70%)`;

  const handleMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set((event.clientX - rect.left) / rect.width);
    mouseY.set((event.clientY - rect.top) / rect.height);
  };

  const handleMouseLeave = () => {
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={
        reduceMotion
          ? undefined
          : {
              rotateX,
              rotateY,
              transformPerspective: 900,
            }
      }
      className={`group relative ${className ?? ''}`}
    >
      {!reduceMotion && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: spotlightBackground }}
        />
      )}
      {children}
    </motion.div>
  );
}
