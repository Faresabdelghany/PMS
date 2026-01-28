import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["node_modules/", ".next/", "out/"],
  },
  {
    // Disable overly strict rules for all files
    rules: {
      // This rule flags common React patterns like setting initial state from props
      "react-hooks/set-state-in-effect": "off",
      // Allow anonymous default exports (common in config files)
      "import/no-anonymous-default-export": "off",
      // Warn instead of error for img elements (sometimes needed for external URLs)
      "@next/next/no-img-element": "warn",
      // React Compiler memoization preservation - warn instead of error
      "react-hooks/preserve-manual-memoization": "warn",
      // Purity rules - warn instead of error for edge cases
      "react-hooks/purity": "warn",
      // Refs rule - warn instead of error
      "react-hooks/refs": "warn",
    },
  },
  {
    // Disable React hooks rules for e2e tests (not React code)
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
];

export default eslintConfig;
