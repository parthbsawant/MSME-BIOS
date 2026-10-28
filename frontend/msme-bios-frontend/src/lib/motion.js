/**
 * Motion System Constants and Variants for MSME-BIOS
 * Easing: cubic-bezier(0.22, 1, 0.36, 1) for entrances, easeOut for hovers.
 * Animate only opacity, transform, and color.
 */

export const durations = {
  micro: 0.2,
  standard: 0.35,
  reveal: 0.65,
  hover: 0.38,
}

export const easings = {
  entrance: [0.22, 1, 0.36, 1],
  hover: [0.16, 1, 0.3, 1],
  smooth: [0.25, 0.8, 0.25, 1],
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
  hover: {
    duration: durations.hover,
    ease: easings.hover,
  },
  springQuick: {
    type: 'spring',
    stiffness: 300,
    damping: 28,
  },
  springSmooth: {
    type: 'spring',
    stiffness: 220,
    damping: 24,
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
  y: -4,
  transition: transitions.hover,
}

/**
 * Chart line drawing animation
 */
export const pathDrawVariants = {
  initial: { pathLength: 0, opacity: 0 },
  animate: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 1.4, ease: [0.16, 1, 0.3, 1] },
      opacity: { duration: 0.4 },
    },
  },
}

/**
 * Bar growth animation
 */
export const barGrowVariants = {
  initial: { scaleY: 0, originY: 1, opacity: 0.4 },
  animate: (i = 0) => ({
    scaleY: 1,
    originY: 1,
    opacity: 1,
    transition: {
      duration: 0.85,
      delay: 0.15 + i * 0.08,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
}
