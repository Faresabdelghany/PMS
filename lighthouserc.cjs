/** @type {import('@lhci/cli').Config} */
module.exports = {
  ci: {
    collect: {
      // Default URLs: production (no local server needed)
      // For local dev: start server manually, then run `pnpm lighthouse`
      url: [
        'https://pms-nine-gold.vercel.app/login',
        'https://pms-nine-gold.vercel.app/signup',
        'https://pms-nine-gold.vercel.app/forgot-password',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        skipAudits: ['uses-http2'],
      },
    },
    assert: {
      assertions: {
        // Performance: error below 75
        'categories:performance': ['error', { minScore: 0.75 }],

        // Best Practices
        'categories:best-practices': ['error', { minScore: 0.95 }],

        // Accessibility
        'categories:accessibility': ['error', { minScore: 0.9 }],

        // SEO
        'categories:seo': ['warn', { minScore: 0.9 }],

        // Core Web Vitals budgets
        'total-blocking-time': ['error', { maxNumericValue: 500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],

        // Largest Contentful Paint
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],

        // First Contentful Paint
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
