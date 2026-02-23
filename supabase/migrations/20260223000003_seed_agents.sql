-- ============================================================
-- Seed: 24 PMS Agents per organization
-- Orgs:
--   9c52b861-abb7-4774-9b5b-3fa55c8392cb (Test User E2E's Workspace)
--   c45dab84-726a-40dd-80f7-aae74539c281 (Fares Workspace)
-- ============================================================

CREATE OR REPLACE FUNCTION _seed_agents_for_org(p_org_id UUID) RETURNS void AS $$
DECLARE
  v_ziko            UUID := gen_random_uuid();
  v_nabil           UUID := gen_random_uuid();
  v_omar            UUID := gen_random_uuid();
  v_karim           UUID := gen_random_uuid();
  v_design_lead     UUID := gen_random_uuid();
  v_product_analyst UUID := gen_random_uuid();
  v_researcher      UUID := gen_random_uuid();
  v_mostafa         UUID := gen_random_uuid();
  v_sara            UUID := gen_random_uuid();
  v_ali             UUID := gen_random_uuid();
  v_yasser          UUID := gen_random_uuid();
  v_hady            UUID := gen_random_uuid();
  v_farah           UUID := gen_random_uuid();
  v_bassem          UUID := gen_random_uuid();
  v_design_agent    UUID := gen_random_uuid();
  v_sami            UUID := gen_random_uuid();
  v_maya            UUID := gen_random_uuid();
  v_amir            UUID := gen_random_uuid();
  v_rami            UUID := gen_random_uuid();
  v_tarek           UUID := gen_random_uuid();
  v_mariam          UUID := gen_random_uuid();
  v_nour            UUID := gen_random_uuid();
  v_salma           UUID := gen_random_uuid();
  v_ziad            UUID := gen_random_uuid();
BEGIN

  -- ── Tier 1: Supreme ────────────────────────────────────────
  INSERT INTO agents (id, organization_id, name, role, description, agent_type, squad, status, ai_provider, ai_model, sort_order, is_active)
  VALUES
  (v_ziko,  p_org_id, 'Ziko',  'Main Assistant',     'Primary AI assistant. Orchestrates all squads. Direct interface with Fares. Owns the full agent coordination pipeline.', 'supreme', 'all', 'online', 'anthropic', 'claude-sonnet-4-6', 0, true),
  (v_nabil, p_org_id, 'Nabil', 'Supreme Commander',  'Coordinates all squads under Ziko. Routes work between Engineering, Marketing, Design, and Product teams.',              'supreme', 'all', 'online', 'anthropic', 'claude-opus-4-6',   1, true);

  UPDATE agents SET reports_to = v_ziko WHERE id = v_nabil;

  -- ── Tier 2: Leads ──────────────────────────────────────────
  INSERT INTO agents (id, organization_id, name, role, description, agent_type, squad, status, ai_provider, ai_model, reports_to, sort_order, is_active)
  VALUES
  (v_omar,            p_org_id, 'Omar',            'Tech Lead (CTO)',      'Engineering squad lead. Reviews all code, runs internal fix loops, manages Backend, Frontend, DevOps, Security, QA, and Docs agents.',        'lead', 'engineering', 'online', 'anthropic', 'claude-opus-4-6', v_nabil, 2, true),
  (v_karim,           p_org_id, 'Karim',           'Marketing Lead (CMO)', 'Marketing squad lead. Manages SEO, Content, Social, Outreach, CRO, Ads agents. Cross-squad collaboration with Tech Lead and Design Lead.', 'lead', 'marketing',   'online', 'anthropic', 'claude-opus-4-6', v_nabil, 3, true),
  (v_design_lead,     p_org_id, 'Design Lead',     'Head of Design',       'Design squad lead. Manages Design Agent. Receives constraints from Tech Lead, delivers specs back. Cross-squad with Marketing Lead.',       'lead', 'all',         'online', 'anthropic', 'claude-opus-4-6', v_nabil, 4, true),
  (v_product_analyst, p_org_id, 'Product Analyst',  'Product Hub',          'PRD authority. No squad starts without an approved PRD. Manages Researcher. Brainstorms with all leads. Defines what to build.',           'lead', 'all',         'online', 'anthropic', 'claude-opus-4-6', v_nabil, 5, true);

  -- ── Tier 3: Engineering Specialists ───────────────────────
  INSERT INTO agents (id, organization_id, name, role, description, agent_type, squad, status, ai_provider, ai_model, reports_to, sort_order, is_active)
  VALUES
  (v_mostafa, p_org_id, 'Mostafa', 'Backend Engineer',        'Builds APIs, database schemas, server actions, Supabase migrations, and backend logic.',                'specialist', 'engineering', 'offline', 'anthropic', 'claude-sonnet-4-6', v_omar, 10, true),
  (v_sara,    p_org_id, 'Sara',    'Frontend Engineer',       'Builds UI components, pages, and client-side logic. Next.js + shadcn/ui + Phosphor icons specialist.', 'specialist', 'engineering', 'offline', 'anthropic', 'claude-sonnet-4-6', v_omar, 11, true),
  (v_ali,     p_org_id, 'Ali',     'DevOps Engineer',         'CI/CD pipelines, Vercel deployments, GitHub Actions, infrastructure, and environment management.',      'specialist', 'engineering', 'offline', 'anthropic', 'claude-sonnet-4-6', v_omar, 12, true),
  (v_yasser,  p_org_id, 'Yasser',  'Security Engineer',       'Security audits, Supabase RLS policies, auth flows, vulnerability assessments, and penetration testing.', 'specialist', 'engineering', 'offline', 'anthropic', 'claude-sonnet-4-6', v_omar, 13, true),
  (v_hady,    p_org_id, 'Hady',    'QA Engineer',             'Testing, bug reports, quality assurance, and regression testing across all squads.',                    'specialist', 'engineering', 'offline', 'anthropic', 'claude-sonnet-4-6', v_omar, 14, true),
  (v_farah,   p_org_id, 'Farah',   'Documentation Engineer',  'API docs, README files, user guides, and technical documentation alongside development.',              'specialist', 'engineering', 'offline', 'anthropic', 'claude-sonnet-4-6', v_omar, 15, true),
  (v_bassem,  p_org_id, 'Bassem',  'Integration Engineer',    'Third-party integrations, API connectors, webhooks, Stripe, and external service setups.',             'specialist', 'engineering', 'offline', 'anthropic', 'claude-sonnet-4-6', v_omar, 16, true);

  -- ── Tier 3: Design Specialist ─────────────────────────────
  INSERT INTO agents (id, organization_id, name, role, description, agent_type, squad, status, ai_provider, ai_model, reports_to, sort_order, is_active)
  VALUES
  (v_design_agent, p_org_id, 'Design Agent', 'UI/UX Designer', 'Wireframes, mockups, design specs, and interaction design. Delivers approved designs to Tech Lead.', 'specialist', 'all', 'offline', 'anthropic', 'claude-sonnet-4-6', v_design_lead, 20, true);

  -- ── Tier 3: Marketing Specialists ────────────────────────
  INSERT INTO agents (id, organization_id, name, role, description, agent_type, squad, status, ai_provider, ai_model, reports_to, sort_order, is_active)
  VALUES
  (v_sami,   p_org_id, 'Sami',   'SEO Specialist',             'Keyword research, on-page SEO, meta tags, schema markup, technical SEO, and search ranking strategy.', 'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 30, true),
  (v_maya,   p_org_id, 'Maya',   'Content Writer',             'Blog posts, landing page copy, email sequences, product descriptions, and long-form content.',         'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 31, true),
  (v_amir,   p_org_id, 'Amir',   'CRO Specialist',             'Conversion rate optimization, A/B testing, signup flow optimization, pricing pages, and onboarding.',  'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 32, true),
  (v_rami,   p_org_id, 'Rami',   'Growth Analyst',             'Growth metrics, funnel analysis, retention strategies, product-led growth, and user cohort analysis.', 'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 33, true),
  (v_tarek,  p_org_id, 'Tarek',  'Brand Strategist',           'Brand positioning, messaging framework, competitive analysis, value proposition, and brand consistency.', 'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 34, true),
  (v_mariam, p_org_id, 'Mariam', 'Email Marketing Specialist', 'Email sequences, drip campaigns, newsletters, lifecycle email programs, and automation flows.',        'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 35, true),
  (v_nour,   p_org_id, 'Nour',   'Social Media Manager',       'Social content, community management, Twitter/X, LinkedIn, build-in-public strategy, and social campaigns.', 'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 36, true),
  (v_salma,  p_org_id, 'Salma',  'Outreach Specialist',        'Cold email, partnership outreach, influencer relations, PR, and community partnerships.',              'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 37, true),
  (v_ziad,   p_org_id, 'Ziad',   'Paid Ads Manager',           'Google Ads, Meta Ads, LinkedIn Ads, campaign management, creative testing, and ROAS optimization.',    'specialist', 'marketing', 'offline', 'google', 'gemini-2.5-flash', v_karim, 38, true);

  -- ── Tier 3: Research Specialist ───────────────────────────
  INSERT INTO agents (id, organization_id, name, role, description, agent_type, squad, status, ai_provider, ai_model, reports_to, sort_order, is_active)
  VALUES
  (v_researcher, p_org_id, 'Researcher', 'Research Analyst', 'Market research, user research, competitive analysis, and technical research. Feeds all leads via Product Analyst.', 'specialist', 'all', 'offline', 'anthropic', 'claude-sonnet-4-6', v_product_analyst, 40, true);

END;
$$ LANGUAGE plpgsql;

-- Seed both organizations
SELECT _seed_agents_for_org('9c52b861-abb7-4774-9b5b-3fa55c8392cb'); -- Test User E2E's Workspace
SELECT _seed_agents_for_org('c45dab84-726a-40dd-80f7-aae74539c281'); -- Fares Workspace

-- Clean up helper function
DROP FUNCTION _seed_agents_for_org(UUID);
