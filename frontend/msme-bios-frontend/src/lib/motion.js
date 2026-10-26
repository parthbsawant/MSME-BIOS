/**
 * Motion System Constants and Variants for MSME-BIOS
 * Easing: cubic-bezier(0.22, 1, 0.36, 1) for entrances, easeOut for hovers.
 * Animate only opacity, transform, and color.
 */

export const durations = {
  micro: 0.16,
  standard: 0.3,
  reveal: 0.55,
}

export const easings = {
  entrance: [0.22, 1, 0.36, 1],
  hover: [0.16, 1, 0.3, 1],
  linear: 'linear',
}

export const transitions = {
  micro: {
    duration: durations.micro,
    ease: 'easeOut',
  },
  standard: {
    duration: durations.standard,
    ease: easings.entrance,
  },
  reveal: {
    duration: durations.reveal,
    ease: easings.entrance,
  },
  springQuick: {
    type: 'spring',
    stiffness: 400,
    damping: 30,
  },
}

/**
 * Standard page transition (subtle fade and small upward translation)
 */
export const pageVariants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: transitions.standard,
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: transitions.micro,
  },
}

/**
 * Reusable fade in variant
 */
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transitions.standard },
  exit: { opacity: 0, transition: transitions.micro },
}

/**
 * Reveal with gentle upward shift
 */
export const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: transitions.reveal },
  exit: { opacity: 0, y: 6, transition: transitions.micro },
}

/**
 * Modals and popup menus
 */
export const scaleIn = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0, transition: transitions.standard },
  exit: { opacity: 0, scale: 0.96, y: -4, transition: transitions.micro },
}

/**
 * Stagger container for lists, grids, and tables
 * Caps max total stagger to avoid delaying user actions
 */
export const createStaggerContainer = (staggerChildren = 0.05, maxDelay = 0.35) => ({
  initial: {},
  animate: {
    transition: {
      staggerChildren: Math.min(staggerChildren, maxDelay),
      delayChildren: 0.02,
    },
  },
})

/**
 * Micro-interactions for interactive controls
 */
export const buttonTap = { scale: 0.98 }
export const cardLift = {
  y: -2,
  transition: transitions.micro,
}
