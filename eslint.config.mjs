import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'TSInterfaceDeclaration[id.name=/^(Transaction|TransactionDetail)$/]',
          message:
            "Do not hand-write Transaction/TransactionDetail. Import from components['schemas'][...] in @/lib/api-types.",
        },
      ],
    },
  },
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'dist/**', 'next-env.d.ts', 'contract/**'],
  },
];
