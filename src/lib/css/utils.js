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

/**
 * Generate a unique CSS identifier by adding a numeric suffix if needed
 * 
 * @param {string} name - The name to convert to CSS identifier
 * @param {Set<string>|Array<string>} existingIdentifiers - Existing identifiers to check against
 * @param {string} [excludeId] - Optional ID to exclude from uniqueness check (for updates)
 * @param {function} [getIdentifierForId] - Optional function to get identifier for an ID (for excludeId support with arrays of objects)
 * @returns {string} Unique CSS identifier
 * 
 * @example
 * toUniqueCSSIdentifier("Rainbow", new Set(["rainbow"])) // "rainbow-2"
 * toUniqueCSSIdentifier("Rainbow", new Set(["rainbow", "rainbow-2"])) // "rainbow-3"
 * toUniqueCSSIdentifier("New", new Set(["rainbow"])) // "new"
 */
export function toUniqueCSSIdentifier(name, existingIdentifiers, excludeId = null, getIdentifierForId = null) {
	const baseIdentifier = toCSSIdentifier(name);
	if (!baseIdentifier) return '';

	// Convert to Set if array
	let identifiersSet;
	if (existingIdentifiers instanceof Set) {
		identifiersSet = existingIdentifiers;
	} else if (Array.isArray(existingIdentifiers)) {
		identifiersSet = new Set(existingIdentifiers);
	} else {
		identifiersSet = new Set();
	}

	// If excludeId is provided, remove that item's identifier from the set
	if (excludeId && getIdentifierForId) {
		const excludedIdentifier = getIdentifierForId(excludeId);
		if (excludedIdentifier) {
			identifiersSet = new Set(identifiersSet);
			identifiersSet.delete(excludedIdentifier);
		}
	}

	// If base identifier is unique, use it
	if (!identifiersSet.has(baseIdentifier)) {
		return baseIdentifier;
	}

	// Find next available number
	let counter = 2;
	while (identifiersSet.has(`${baseIdentifier}-${counter}`)) {
		counter++;
	}

	return `${baseIdentifier}-${counter}`;
}
