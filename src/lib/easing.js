/**
 * Easing functions for timeline interpolation
 * All functions take a value t in range [0, 1] and return interpolated value in [0, 1]
 */

export const EASING_FUNCTIONS = {
    linear: (t) => t,

    easeInQuad: (t) => t * t,
    easeOutQuad: (t) => t * (2 - t),
    easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

    easeInCubic: (t) => t * t * t,
    easeOutCubic: (t) => (--t) * t * t + 1,
    easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

    easeInSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
    easeOutSine: (t) => Math.sin((t * Math.PI) / 2),
    easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

/**
 * Interpolate between two values using an easing function
 */
export function interpolate(startValue, endValue, t, easingName = 'linear') {
    const easingFn = EASING_FUNCTIONS[easingName] || EASING_FUNCTIONS.linear;
    const easedT = easingFn(t);
    return Math.round(startValue + (endValue - startValue) * easedT);
}

/**
 * Get list of easing function names for UI selection
 */
export function getEasingNames() {
    return Object.keys(EASING_FUNCTIONS);
}
