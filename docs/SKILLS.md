# Claude Code Skills Reference

A comprehensive reference of all available Claude Code skills for the PMS project.

---

## Table of Contents

- [Core Development](#core-development)
- [Performance](#performance)
- [Testing & Browser Automation](#testing--browser-automation)
- [UI Design](#ui-design)
- [Security](#security)
- [Code Review](#code-review)
- [Deployment](#deployment)
- [Superpowers (Workflow)](#superpowers-workflow)
- [Superpowers Lab (Experimental)](#superpowers-lab-experimental)
- [Memory & Context](#memory--context)
- [Writing & Documentation](#writing--documentation)
- [Claude Code Development](#claude-code-development)
- [Image Generation](#image-generation)
- [Keyboard & Configuration](#keyboard--configuration)

---

## Core Development

### `vercel-react-best-practices`

React and Next.js performance optimization guidelines sourced from Vercel Engineering. Provides patterns for writing performant React components, optimizing data fetching, reducing bundle size, and following App Router best practices. Use when writing, reviewing, or refactoring React/Next.js code.

### `vercel-composition-patterns`

React composition patterns that scale. Covers compound components, render props, context providers, and component API design. Use when refactoring components with boolean prop proliferation, building flexible component libraries, or designing reusable component architectures. Includes React 19 API changes.

### `vercel-react-native-skills`

React Native and Expo best practices for building performant mobile apps. Covers native component optimization, list performance, animations with Reanimated, and working with native modules. Use when building or optimizing React Native applications.

---

## Performance

### `perf-audit`

Runs a comprehensive performance audit on any web application. Auto-detects the framework (Next.js, React, Angular, Vue, .NET), discovers routes, and measures First Contentful Paint (FCP), Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS), Time to First Byte (TTFB), bundle sizes, and Lighthouse scores across all pages. Supports sub-commands: `pages`, `lighthouse`, `bundle`, `interactions`, `vitals`.

### `perf`

Runs a full performance audit specifically configured for the PMS application. Equivalent to `perf-audit` but pre-configured with PMS-specific routes and settings.

---

## Testing & Browser Automation

### `playwright-cli`

Automates browser interactions for web testing, form filling, screenshots, and data extraction. Use when you need to navigate websites, interact with web pages, fill out forms, take screenshots, test web applications end-to-end, or extract information from rendered web pages.

---

## UI Design

### `ui-design:design-review`

Reviews existing UI code for design issues and suggests improvements. Analyzes component structure, visual consistency, spacing, color usage, and interaction patterns. Use when you want a holistic review of your UI implementation.

### `ui-design:accessibility-audit`

Audits UI code for WCAG (Web Content Accessibility Guidelines) compliance. Checks for proper ARIA attributes, keyboard navigation, color contrast, screen reader compatibility, and semantic HTML usage. Use when validating accessibility of components or pages.

### `ui-design:create-component`

Guided component creation with proper patterns. Walks through component design decisions including props API, variants, accessibility, responsiveness, and composition patterns. Use when building new UI components from scratch.

### `ui-design:design-system-setup`

Initializes a design system with design tokens (colors, spacing, typography, shadows). Sets up the foundational token architecture and theming infrastructure for a component library.

### `ui-design:accessibility-compliance`

Implements WCAG 2.2 compliant interfaces with mobile accessibility, inclusive design patterns, and assistive technology support. Goes beyond auditing to actively implement ARIA patterns, screen reader optimizations, and inclusive user experiences.

### `ui-design:design-system-patterns`

Builds scalable design systems with design tokens, theming infrastructure, and component architecture patterns. Covers token architecture, multi-brand theming, and design-development collaboration workflows.

### `ui-design:interaction-design`

Designs and implements microinteractions, motion design, transitions, and user feedback patterns. Use when adding polish to UI interactions, implementing loading states, skeleton animations, or creating delightful user experiences.

### `ui-design:responsive-design`

Implements modern responsive layouts using container queries, fluid typography, CSS Grid, and mobile-first breakpoint strategies. Use when building adaptive interfaces or implementing component-level responsive behavior.

### `ui-design:visual-design-foundations`

Applies typography, color theory, spacing systems, and iconography principles to create cohesive visual designs. Use when establishing design tokens, building style guides, or improving visual hierarchy and consistency.

### `ui-design:web-component-design`

Masters React, Vue, and Svelte component patterns including CSS-in-JS, composition strategies, and reusable component architecture. Use when building UI component libraries, designing component APIs, or implementing frontend design systems.

### `ui-design:mobile-ios-design`

Masters iOS Human Interface Guidelines and SwiftUI patterns for building native iOS apps. Use when designing iOS interfaces, implementing SwiftUI views, or ensuring apps follow Apple's design principles.

### `ui-design:mobile-android-design`

Masters Material Design 3 and Jetpack Compose patterns for building native Android apps. Use when designing Android interfaces, implementing Compose UI, or following Google's Material Design guidelines.

### `ui-design:react-native-design`

Masters React Native styling, navigation patterns, and Reanimated animations for cross-platform mobile development. Use when building React Native apps, implementing navigation, or creating performant mobile animations.

### `web-design-guidelines`

Reviews UI code against the Web Interface Guidelines specification. Checks for best practices in layout, navigation, forms, feedback, and overall UX patterns. Use when you want a standards-based review of your web interface.

---

## Security

### `security-scanning:security-sast`

Static Application Security Testing (SAST) for code vulnerability analysis. Scans source code across multiple languages and frameworks to identify security vulnerabilities such as SQL injection, XSS, insecure deserialization, and hardcoded secrets.

### `security-scanning:security-hardening`

Orchestrates comprehensive security hardening with a defense-in-depth strategy across all application layers. Covers input validation, authentication, authorization, encryption, headers, CSP, and infrastructure security.

### `security-scanning:attack-tree-construction`

Builds comprehensive attack trees to visualize threat paths through the application. Use when mapping attack scenarios, identifying defense gaps, or communicating security risks to stakeholders with visual diagrams.

### `security-scanning:sast-configuration`

Configures Static Application Security Testing (SAST) tools for automated vulnerability detection. Use when setting up security scanning pipelines, implementing DevSecOps practices, or automating code vulnerability detection in CI/CD.

### `security-scanning:security-requirement-extraction`

Derives actionable security requirements from threat models and business context. Use when translating identified threats into security user stories, acceptance criteria, and test cases.

### `security-scanning:stride-analysis-patterns`

Applies the STRIDE methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) to systematically identify threats. Use when conducting formal threat modeling sessions or creating security documentation.

### `security-scanning:threat-mitigation-mapping`

Maps identified threats to appropriate security controls and mitigations. Use when prioritizing security investments, creating remediation plans, or validating that existing controls adequately address known threats.

---

## Code Review

### `code-review:code-review`

Reviews a pull request for code quality, correctness, and best practices. Analyzes diffs, checks for bugs, suggests improvements, and validates against project conventions.

### `coderabbit:code-review`

AI-powered code review using CodeRabbit. Provides automated code review with security vulnerability detection, performance issue identification, and code quality checks. Supports autonomous fix-review cycles.

### `comprehensive-review:full-review`

Orchestrates a comprehensive multi-dimensional code review using specialized review agents. Covers architecture, security, performance, testing, and best practices in a single coordinated review pass.

---

## Deployment

### `vercel:deploy`

Deploys the current project to Vercel. Handles build, deployment, and provides the deployment URL. Use when ready to push changes to staging or production.

### `vercel:logs`

Views deployment logs from Vercel. Use when debugging failed deployments, checking build output, or investigating runtime errors in production.

### `vercel:setup`

Sets up the Vercel CLI and configures the project for deployment. Links the local project to a Vercel project, configures environment variables, and establishes the deployment pipeline.

---

## Superpowers (Workflow)

### `superpowers:brainstorming`

Explores user intent, requirements, and design before any creative work begins. Must be used before creating features, building components, adding functionality, or modifying behavior. Ensures alignment on what to build before writing code.

### `superpowers:writing-plans`

Creates detailed implementation plans for multi-step tasks. Analyzes the codebase, identifies affected files, considers edge cases, and produces a step-by-step plan before any code is touched.

### `superpowers:executing-plans`

Executes a written implementation plan in a separate session with review checkpoints. Follows the plan step-by-step, pausing at defined checkpoints for review and course correction.

### `superpowers:test-driven-development`

Enforces a write-tests-first methodology. Use when implementing new features or fixing bugs to ensure tests are written before implementation code, maintaining high test coverage.

### `superpowers:systematic-debugging`

Provides a structured debugging methodology for any bug, test failure, or unexpected behavior. Investigates root causes systematically before proposing fixes, avoiding guesswork.

### `superpowers:dispatching-parallel-agents`

Dispatches multiple agents to work on independent tasks simultaneously. Use when facing 2+ tasks that have no shared state or sequential dependencies, maximizing throughput.

### `superpowers:subagent-driven-development`

Executes implementation plans using independent subagents in the current session. Each subagent handles a discrete task from the plan, working in parallel where possible.

### `superpowers:requesting-code-review`

Initiates a code review after completing a task, implementing a major feature, or before merging. Ensures work meets requirements and follows project conventions.

### `superpowers:receiving-code-review`

Handles incoming code review feedback with technical rigor. Verifies suggestions before implementing them rather than blindly accepting feedback. Use when review comments seem unclear or technically questionable.

### `superpowers:verification-before-completion`

Runs verification commands and confirms output before claiming work is complete. Prevents false completion claims by requiring evidence (passing tests, successful builds) before assertions.

### `superpowers:finishing-a-development-branch`

Guides the completion of development work by presenting structured options for merge, pull request, or cleanup. Use when implementation is complete and all tests pass.

### `superpowers:using-git-worktrees`

Creates isolated git worktrees for feature work. Provides smart directory selection and safety verification to ensure clean separation between concurrent development efforts.

### `superpowers:writing-skills`

Creates, edits, and verifies Claude Code skills before deployment. Use when building new skills or modifying existing ones to ensure they work correctly.

### `superpowers:using-superpowers`

Establishes how to find and use available skills at the start of any conversation. Acts as a discovery mechanism for all other superpowers skills.

---

## Superpowers Lab (Experimental)

### `superpowers-lab:finding-duplicate-functions`

Audits a codebase for semantic duplication — functions that do the same thing but have different names or implementations. Especially useful for LLM-generated codebases where new functions are often created instead of reusing existing ones.

### `superpowers-lab:mcp-cli`

Uses MCP (Model Context Protocol) servers on-demand via the CLI. Discovers tools, resources, and prompts from MCP servers without polluting context with pre-loaded integrations.

### `superpowers-lab:slack-messaging`

Sends and reads Slack messages, checks channels, and interacts with a Slack workspace from the command line. Use when you need to communicate via Slack during development workflows.

### `superpowers-lab:using-tmux-for-interactive-commands`

Runs interactive CLI tools (vim, git rebase -i, Python REPL, etc.) that require real-time input/output. Uses tmux-based approach for controlling interactive sessions through detached sessions and send-keys.

---

## Memory & Context

### `episodic-memory:search-conversations`

Searches previous Claude Code conversations using semantic or text search. Use when you need to find past decisions, solutions, or context from earlier sessions.

### `episodic-memory:remembering-conversations`

Recalls past approaches, solutions, and lessons learned from conversation history. Use when stuck, exploring unfamiliar code, or when the user references past work.

---

## Writing & Documentation

### `elements-of-style:writing-clearly-and-concisely`

Applies Strunk & White's timeless writing rules to any prose humans will read — documentation, commit messages, error messages, explanations, reports, or UI text. Makes writing clearer, stronger, and more professional.

---

## Claude Code Development

### `claude-code-setup:claude-automation-recommender`

Analyzes a codebase and recommends Claude Code automations including hooks, subagents, skills, plugins, and MCP servers. Use when optimizing your Claude Code setup or first configuring Claude Code for a project.

### `superpowers-developing-for-claude-code:developing-claude-code-plugins`

Provides streamlined workflows, patterns, and examples for the complete Claude Code plugin lifecycle — creating, modifying, testing, releasing, and maintaining plugins.

### `superpowers-developing-for-claude-code:working-with-claude-code`

Comprehensive official documentation for all aspects of Claude Code — CLI features, plugins, hooks, MCP servers, skills, configuration, and IDE integrations.

---

## Image Generation

### `nano-banana-pro:generate`

Generates images using Google's Gemini 2.5 Flash model. Creates images for any purpose — frontend designs, web projects, illustrations, graphics, hero images, icons, backgrounds, or standalone artwork. Supports generating multiple images in a single request.

---

## Keyboard & Configuration

### `keybindings-help`

Customizes keyboard shortcuts for Claude Code. Supports rebinding keys, adding chord shortcuts, modifying the submit key, and editing `~/.claude/keybindings.json`.

---

## Quick Reference

| Category | Count | Key Skills |
|---|---|---|
| Core Development | 3 | `vercel-react-best-practices`, `vercel-composition-patterns` |
| Performance | 2 | `perf-audit`, `perf` |
| Testing | 1 | `playwright-cli` |
| UI Design | 14 | `design-review`, `accessibility-audit`, `create-component` |
| Security | 7 | `security-sast`, `security-hardening`, `stride-analysis-patterns` |
| Code Review | 3 | `code-review`, `coderabbit`, `comprehensive-review` |
| Deployment | 3 | `vercel:deploy`, `vercel:logs`, `vercel:setup` |
| Superpowers | 14 | `brainstorming`, `writing-plans`, `systematic-debugging` |
| Superpowers Lab | 4 | `finding-duplicate-functions`, `mcp-cli` |
| Memory | 2 | `search-conversations`, `remembering-conversations` |
| Writing | 1 | `elements-of-style` |
| Claude Code Dev | 3 | `claude-automation-recommender`, `developing-plugins` |
| Image Generation | 1 | `nano-banana-pro:generate` |
| Configuration | 1 | `keybindings-help` |
| **Total** | **59** | |

---

## Usage

Invoke any skill by typing its name as a slash command:

```
/perf-audit              # Run performance audit
/vercel:deploy           # Deploy to Vercel
/code-review:code-review # Review a PR
```

For skills with sub-commands, pass arguments after the skill name:

```
/perf-audit bundle       # Bundle size analysis only
/perf-audit lighthouse   # Lighthouse audit only
```
