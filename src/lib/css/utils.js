/**
 * CSS Utilities
 * 
 * Common utilities for working with CSS identifiers, classes, and custom properties.
 */

/**
 * Convert a name to a CSS-safe identifier
 * Transforms to lowercase and replaces non-alphanumeric characters with dashes
 * Removes leading/trailing dashes
 * 
 * Can be used for:
 * - CSS class names
 * - CSS animation names
 * - CSS custom property names (add -- prefix manually)
 * - Any other CSS identifier
 * 
 * @param {string} name - The name to convert
 * @returns {string} CSS-safe identifier (e.g., "My Button" -> "my-button")
 * 
 * @example
 * toCSSIdentifier("My Button") // "my-button"
 * toCSSIdentifier("RGB / All") // "rgb-all"
 * toCSSIdentifier("--custom-prop") // "custom-prop"
 * `--${toCSSIdentifier("My Prop")}` // "--my-prop"
 */
export function toCSSIdentifier(name) {
	if (!name) return '';
	
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
		.replace(/^-+|-+$/g, '');      // Remove leading/trailing dashes
}
