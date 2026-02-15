import nextConfig from "eslint-config-next";

// All plugin-based rule overrides must be merged into the config object
// that owns the plugin (Config 0 has react, react-hooks, import, jsx-a11y, @next/next).
// ESLint flat config requires plugins and their rules to live in the same object.
const pluginRuleOverrides = {
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
};

const eslintConfig = [
  // Merge rule overrides into the config object that owns the plugins (index 0)
  ...nextConfig.map((config, index) =>
    index === 0
      ? { ...config, rules: { ...config.rules, ...pluginRuleOverrides } }
      : config
  ),
  {
    ignores: ["node_modules/", ".next/", "out/"],
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
