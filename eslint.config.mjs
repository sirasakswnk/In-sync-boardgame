import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'coverage/**'] },
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // โค้ดกติกาต้องบริสุทธิ์: ห้ามผูกกับ Firebase/Next เพื่อให้ทดสอบได้โดยไม่ต้องมี credential
    files: ['src/lib/game/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['firebase', 'firebase/*', 'firebase-admin', 'firebase-admin/*'],
              message: 'src/lib/game ต้องไม่ผูกกับ Firebase',
            },
            { group: ['next', 'next/*'], message: 'src/lib/game ต้องไม่ผูกกับ Next.js' },
          ],
        },
      ],
    },
  },
];

export default config;
