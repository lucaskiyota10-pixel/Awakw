import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // fontes da marca são configuráveis por projeto e carregadas via <link> (Google Fonts)
  { rules: { "@next/next/no-page-custom-font": "off" } },
  { ignores: [".next/**", ".next-build/**", "node_modules/**"] },
];
