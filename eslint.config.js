import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import {defineConfig, globalIgnores} from 'eslint/config';

export default defineConfig([
	globalIgnores(['dist']),
	{
		files: ['**/*.{ts,tsx}'],
		extends: [
			js.configs.recommended,
			tseslint.configs.recommended,
			reactHooks.configs.flat.recommended,
			reactRefresh.configs.vite,
		],
		languageOptions: {
			globals: globals.browser,
		},
		plugins: {
			'react-hooks': reactHooks,
		},
		rules: {
			...js.configs.recommended.rules,
			...reactHooks.configs.recommended.rules,

			// базовые правила js
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['error', {
				varsIgnorePattern: '^[A-Z_]',
				argsIgnorePattern: '^_',
			}],
			'no-undef': 'error',
			'no-shadow-restricted-names': 'error',
			'no-redeclare': 'error',

			'semi': ['warn', 'always'],
			'quotes': ['error', 'single'],
			'indent': ['error', 'tab', {SwitchCase: 1}],
			'lines-between-class-members': ['error', 'always'],
			'brace-style': ['error', '1tbs', {allowSingleLine: false}],
			'keyword-spacing': ['error', {before: true, after: true}],
			'space-infix-ops': 'error',
			'space-in-parens': ['error', 'never'],
			'array-bracket-spacing': ['error', 'never'],
			'object-curly-spacing': ['error', 'never'],
			'key-spacing': ['error', {beforeColon: false, afterColon: true}],
			'comma-spacing': ['error', {before: false, after: true}],
			'block-spacing': ['error', 'always'],
			'padded-blocks': ['error', {classes: 'always', blocks: 'never'}],

			// реакт правила
			'react-hooks/exhaustive-deps': 'off',
		},
	},
	{
		files: ['src/app/providers/**/*.{ts,tsx}'],
		rules: {
			'react-refresh/only-export-components': 'off',
		},
	},
]);
