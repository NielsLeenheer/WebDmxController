import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default [
	js.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		rules: {
			// Warn on unused variables, but allow unused function parameters prefixed with _
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			// Allow console statements
			'no-console': 'off',
			// Allow {@html} for trusted internal SVG icons
			'svelte/no-at-html-tags': 'off',
			// Allow Map/Set in non-reactive contexts (we use them for internal state)
			'svelte/prefer-svelte-reactivity': 'warn',
			// Warn (not error) for missing each keys - will fix gradually
			'svelte/require-each-key': 'warn'
		}
	},
	{
		ignores: ['dist/', 'node_modules/', '.svelte-kit/']
	}
];
