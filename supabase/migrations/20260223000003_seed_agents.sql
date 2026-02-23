-- ============================================================
-- Seed: 24 PMS Agents
-- Org: 9c52b861-abb7-4774-9b5b-3fa55c8392cb (Test User E2E's Workspace)
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

DO $$
DECLARE
  v_org_id        UUID := '9c52b861-abb7-4774-9b5b-3fa55c8392cb';
  v_ziko          UUID := gen_random_uuid();
  v_nabil         UUID := gen_random_uuid();
  v_omar          UUID := gen_random_uuid();
  v_karim         UUID := gen_random_uuid();
  v_design_lead   UUID := gen_random_uuid();
  v_product_analyst UUID := gen_random_uuid();
  v_researcher    UUID := gen_random_uuid();
  v_mostafa       UUID := gen_random_uuid();
  v_sara          UUID := gen_random_uuid();
  v_ali           UUID := gen_random_uuid();
  v_yasser        UUID := gen_random_uuid();
  v_hady          UUID := gen_random_uuid();
  v_farah         UUID := gen_random_uuid();
  v_bassem        UUID := gen_random_uuid();
  v_design_agent  UUID := gen_random_uuid();
  v_sami          UUID := gen_random_uuid();
  v_maya          UUID := gen_random_uuid();
  v_amir          UUID := gen_random_uuid();
  v_rami          UUID := gen_random_uuid();
  v_tarek         UUID := gen_random_uuid();
  v_mariam        UUID := gen_random_uuid();
  v_nour          UUID := gen_random_uuid();
  v_salma         UUID := gen_random_uuid();
  v_ziad          UUID := gen_random_uuid();
BEGIN

  -- ── Tier 1: Supreme ────────────────────────────────────────
  INSERT INTO agents (id, organization_id, name, role, description, agent_type, squad, status, ai_provider, ai_model, sort_order, is_active)
  VALUES
  (v_ziko, v_org_id, 'Ziko', 'Main Assistant', 'Primary AI assistant. Orchestrates all squads. Direct interface with Fares. Owns the full agent coordination pipeline.', 'supreme', 'all', 'online', 'anthropic', 'claude-sonnet-4-6', 0, true),
  (v_nabil, v_org_id, 'Nabil', 'Supreme Commander', 'Coordinates all squads under Ziko. Routes work between Engineering, Marketing, Design, and Product teams.', 'supreme', 'all', 'online', 'anthropic', 'claude-opus-4-6', 1, true);

  -- Update Nabil to report to Ziko
  UPDATE agents SET reports_to = v_ziko WHERE id = v_nabil;

  -- ── Tier 2: Leads ──────────────────────────────────────────
  INSERT INTO agents (id, organization_id, name, role, description, agent_type, squad, status, ai_provider, ai_model, reports_to, sort_order, is_active)
  VALUES
  (v_omar,           v_org_id, 'Omar',           'Tech Lead (CTO)',      'Engineering squad lead. Reviews all code, runs internal fix loops, manages Backend, Frontend, DevOps, Security, QA, and Docs agents.',          'lead', 'engineering', 'online', 'anthropic', 'claude-opus-4-6',     v_nabil, 2, true),
  (v_karim,          v_org_id, 'Karim',          'Marketing Lead (CMO)', 'Marketing squad lead. Manages SEO, Content, Social, Outreach, CRO, Ads agents. Cross-squad collaboration with Tech Lead and Design Lead.',       'lead', 'marketing',   'online', 'anthropic', 'claude-opus-4-6',     v_nabil, 3, true),
  (v_design_lead,    v_org_id, 'Design Lead',    'Head of Design',       'Design squad lead. Manages Design Agent. Receives constraints from Tech Lead, delivers specs back. Cross-squad with Marketing Lead for brand.',   'lead', 'all',         'online', 'anthropic', 'claude-opus-4-6',     v_nabil, 4, true),
  (v_product_analyst,v_org_id, 'Product Analyst','Product Hub',          'PRD authority. No squad starts without an approved PRD. Manages Researcher. Brainstorms with all leads. Defines what to build.',               'lead', 'all',         'online', 'anthropic', 'claude-opus-4-6',     v_nabil, 5, true);

  -- ── Tier 3: Engineering Specialists ───────────────────────
  INSERT INTO agents (id, organization_id, name, role, description, agent_type, squad, status, ai_provider, ai_model, reports_to, sort_order, is_active)
  VALUES
  (v_mostafa, v_org_id, 'Mostafa', 'Backend Engineer',        'Builds APIs, database schemas, server actions, Supabase migrations, and backend logic. Reports to Omar.',                      'specialist', 'engineering', 'offline', 'anthropic', 'claude-sonnet-4-6', v_omar, 10, true),
  (v_sara,    v_org_id, 'Sara',    'Frontend Engineer',       'Builds UI components, pages, and client-side logic. Next.js + shadcn/ui + Phosphor icons specialist. Reports to Omar.',        'specialist', 'engineering', 'offline', 'anthropic', 'claude-sonnet-4-6', v_omar, 11, true),
  (v_ali,     v_org_id, 'Ali',     'DevOps Engineer',         'CI/CD pipelines, Vercel deployments, GitHub Actions, infrastructure, and environment management. Reports to Omar.',             'specialist', 'engineering', 'offline', 'anthropic', 'claude-sonnet-4-6', v_omar, 12, true),
  (v_yasser,  v_org_id, 'Yasser',  'Security Engineer',       'Security audits, Supabase RLS policies, auth flows, vulnerability assessments, and penetration testing. Reports to Omar.',     'specialist', 'engineering', 'offline', 'anthropic', 'claude-sonnet-4-6', v_omar, 13, true),
  (v_hady,    v_org_id, 'Hady',    'QA Engineer',             'Testing, bug reports, quality assurance, and regression testing across all squads. Reports to Omar.',                          'specialist', 'engineering', 'offline', 'anthropic', 'claude-sonnet-4-6', v_omar, 14, true),
  (v_farah,   v_org_id, 'Farah',   'Documentation Engineer',  'API docs, README files, user guides, and technical documentation alongside development. Reports to Omar.',                     'specialist', 'engineering', 'offline', 'anthropic', 'claude-sonnet-4-6', v_omar, 15, true),
  (v_bassem,  v_org_id, 'Bassem',  'Integration Engineer',    'Third-party integrations, API connectors, webhooks, Stripe, and external service setups. Reports to Omar.',                   'specialist', 'engineering', 'offline', 'anthropic', 'claude-sonnet-4-6', v_omar, 16, true);

  -- ── Tier 3: Design Specialist ─────────────────────────────
  INSERT INTO agents (id, organization_id, name, role, description, agent_type, squad, status, ai_provider, ai_model, reports_to, sort_order, is_active)
  VALUES
  (v_design_agent, v_org_id, 'Design Agent', 'UI/UX Designer', 'Wireframes, mockups, design specs, and interaction design. Delivers approved designs to Tech Lead. Reports to Design Lead.', 'specialist', 'all', 'offline', 'anthropic', 'claude-sonnet-4-6', v_design_lead, 20, true);

  -- ── Tier 3: Marketing Specialists ────────────────────────
  INSERT INTO agents (id, organization_id, name, role, description, agent_type, squad, status, ai_provider, ai_model, reports_to, sort_order, is_active)
  VALUES
  (v_sami,   v_org_id, 'Sami',   'SEO Specialist',              'Keyword research, on-page SEO, meta tags, schema markup, technical SEO, and search ranking strategy. Reports to Karim.',           'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 30, true),
  (v_maya,   v_org_id, 'Maya',   'Content Writer',              'Blog posts, landing page copy, email sequences, product descriptions, and long-form content. Reports to Karim.',                  'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 31, true),
  (v_amir,   v_org_id, 'Amir',   'CRO Specialist',              'Conversion rate optimization, A/B testing, signup flow optimization, pricing pages, and onboarding. Reports to Karim.',           'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 32, true),
  (v_rami,   v_org_id, 'Rami',   'Growth Analyst',              'Growth metrics, funnel analysis, retention strategies, product-led growth, and user cohort analysis. Reports to Karim.',          'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 33, true),
  (v_tarek,  v_org_id, 'Tarek',  'Brand Strategist',            'Brand positioning, messaging framework, competitive analysis, value proposition, and brand consistency. Reports to Karim.',       'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 34, true),
  (v_mariam, v_org_id, 'Mariam', 'Email Marketing Specialist',  'Email sequences, drip campaigns, newsletters, lifecycle email programs, and automation flows. Reports to Karim.',                 'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 35, true),
  (v_nour,   v_org_id, 'Nour',   'Social Media Manager',        'Social content, community management, Twitter/X, LinkedIn, build-in-public strategy, and social campaigns. Reports to Karim.',   'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 36, true),
  (v_salma,  v_org_id, 'Salma',  'Outreach Specialist',         'Cold email, partnership outreach, influencer relations, PR, and community partnerships. Reports to Karim.',                      'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 37, true),
  (v_ziad,   v_org_id, 'Ziad',   'Paid Ads Manager',            'Google Ads, Meta Ads, LinkedIn Ads, campaign management, creative testing, and ROAS optimization. Reports to Karim.',            'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 38, true);

  -- ── Tier 3: Research Specialist ───────────────────────────
  INSERT INTO agents (id, organization_id, name, role, description, agent_type, squad, status, ai_provider, ai_model, reports_to, sort_order, is_active)
  VALUES
  (v_researcher, v_org_id, 'Researcher', 'Research Analyst', 'Market research, user research, competitive analysis, and technical research. Feeds all leads via Product Analyst. Reports to Product Analyst.', 'specialist', 'all', 'offline', 'anthropic', 'claude-sonnet-4-6', v_product_analyst, 40, true);

  RAISE NOTICE 'Successfully seeded 24 agents for org %', v_org_id;
END $$;
