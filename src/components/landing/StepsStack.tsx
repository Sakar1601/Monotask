import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from 'framer-motion';

gsap.registerPlugin(ScrollTrigger);

export interface StepsStackItem {
  key: string;
  content: ReactNode;
}

/**
 * GSAP sticky-stack for the "three steps" narrative: each step pins at the
 * viewport top and shrinks away as the next one arrives, matching the
 * canonical taste-skill 5.A skeleton exactly (start: "top top", pin: true,
 * scale/opacity driven by the NEXT card's trigger).
 *
 * Isolated GSAP leaf: no Motion or Three.js animation loop shares this tree.
 * Reduced motion and mobile (< 768px) both collapse to a plain vertical
 * stack with no pinning, via gsap.matchMedia().
 */
export function StepsStack({ items }: { items: StepsStackItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || !containerRef.current) return;

    const ctx = gsap.context(() => {
      // Pinned sticky-stack only from md up. Below that, GSAP does nothing
      // and the section falls back to normal vertical scroll (see className
      // below, which drops the sticky positioning under md via Tailwind).
      gsap.matchMedia().add('(min-width: 768px)', () => {
        const cardEls = gsap.utils.toArray<HTMLElement>('.step-stack-card');
        cardEls.forEach((card, i) => {
          if (i === cardEls.length - 1) return;
          ScrollTrigger.create({
            trigger: card,
            start: 'top top',
            endTrigger: cardEls[cardEls.length - 1],
            end: 'top top',
            pin: true,
            pinSpacing: false,
          });
          // Fully clear the outgoing card (opacity 0, lifted up and shrunk)
          // well before the incoming card reaches center, so the two never
          // sit at readable opacity in the same screen position at once.
          // The previous 0.92/0.55 mid-fade left both cards' text legible
          // and overlapping for most of the scroll range.
          gsap.to(card, {
            scale: 0.85,
            opacity: 0,
            y: -80,
            ease: 'none',
            scrollTrigger: {
              trigger: cardEls[i + 1],
              start: 'top bottom',
              end: 'top 55%',
              scrub: true,
            },
          });
        });
        // No cleanup returned here: this callback's own tweens/triggers were
        // created inside the outer gsap.context(), so ctx.revert() below
        // already tears them down. A self-referential `mm.revert()` used to
        // sit here, which made the matchMedia's own internal revert call
        // this same cleanup, which called revert again, infinitely - a
        // stack-overflow crash on any unmount/cleanup of this component.
      });
    }, containerRef);

    return () => ctx.revert();
  }, [reduceMotion]);

  return (
    <div ref={containerRef} className="relative">
      {items.map((item) => (
        <div
          key={item.key}
          className="step-stack-card md:sticky md:top-0 flex min-h-[70vh] md:min-h-[92dvh] items-center justify-center py-10 md:py-0"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
