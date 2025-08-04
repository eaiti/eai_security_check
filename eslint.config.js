const js = require('@eslint/js');
const typescriptParser = require('@typescript-eslint/parser');
const typescriptPlugin = require('@typescript-eslint/eslint-plugin');
const prettierPlugin = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');
const globals = require('globals');
const angularEslint = require('@angular-eslint/eslint-plugin');
const angularTemplateParser = require('@angular-eslint/template-parser');
const angularTemplatePlugin = require('@angular-eslint/eslint-plugin-template');

module.exports = [
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
      },
      globals: {
        ...globals.node,
        ...globals.jest,
        NodeJS: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
      prettier: prettierPlugin
    },
    rules: {
      ...typescriptPlugin.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': [
        'error',
        {},
        {
          usePrettierrc: true,
          fileInfoOptions: {
            withNodeModules: false
          }
        }
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'prefer-const': 'error',
      'no-var': 'error'
    }
  },
  // Angular TypeScript files
  {
    files: ['ui/src/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
      },
      globals: {
        ...globals.browser
      }
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
      '@angular-eslint': angularEslint,
      prettier: prettierPlugin
    },
    rules: {
      ...typescriptPlugin.configs.recommended.rules,
      ...angularEslint.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': [
        'error',
        {},
        {
          usePrettierrc: true,
          fileInfoOptions: {
            withNodeModules: false
          }
        }
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@angular-eslint/component-class-suffix': 'error',
      '@angular-eslint/directive-class-suffix': 'error',
      '@angular-eslint/no-empty-lifecycle-method': 'error',
      '@angular-eslint/prefer-on-push-component-change-detection': 'warn'
    }
  },
  // Angular TypeScript test files
  {
    files: ['ui/src/**/*.spec.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
      },
      globals: {
        ...globals.browser,
        ...globals.jasmine
      }
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
      '@angular-eslint': angularEslint,
      prettier: prettierPlugin
    },
    rules: {
      ...typescriptPlugin.configs.recommended.rules,
      ...angularEslint.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': [
        'error',
        {},
        {
          usePrettierrc: true,
          fileInfoOptions: {
            withNodeModules: false
          }
        }
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@angular-eslint/component-class-suffix': 'off', // Allow test components without suffix
      '@angular-eslint/prefer-on-push-component-change-detection': 'off' // Allow for tests
    }
  },
  // Angular HTML templates
  {
    files: ['ui/src/**/*.html'],
    languageOptions: {
      parser: angularTemplateParser
    },
    plugins: {
      '@angular-eslint/template': angularTemplatePlugin
    },
    rules: {
      ...angularTemplatePlugin.configs.recommended.rules,
      '@angular-eslint/template/banana-in-box': 'error',
      '@angular-eslint/template/no-negated-async': 'error',
      '@angular-eslint/template/conditional-complexity': ['error', { maxComplexity: 3 }]
    }
  },
  {
    ignores: ['dist/', 'node_modules/', 'jest.config.js', 'ui/dist/', 'ui/node_modules/']
  }
];
