import { useRef, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { VariantProps } from 'class-variance-authority';

interface MagneticButtonProps extends VariantProps<typeof buttonVariants> {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  strength?: number;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

/**
 * Pointer-tracking magnetic pull for primary CTAs, plus spring press feedback.
 * Continuous pointer offsets live in motion values (never React state) so
 * the pull never re-renders the component tree. Styled with the same
 * buttonVariants as the shadcn Button so it drops in as a visual match.
 */
export function MagneticButton({
  children,
  className,
  onClick,
  strength = 0.35,
  variant,
  size,
  type = 'button',
  disabled,
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 30 });
  const springY = useSpring(y, { stiffness: 300, damping: 30 });

  const handleMouseMove = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const offsetX = event.clientX - (rect.left + rect.width / 2);
    const offsetY = event.clientY - (rect.top + rect.height / 2);
    x.set(offsetX * strength);
    y.set(offsetY * strength);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={reduceMotion ? undefined : { x: springX, y: springY }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {children}
    </motion.button>
  );
}
