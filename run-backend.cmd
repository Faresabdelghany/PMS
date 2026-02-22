@echo off
cd /d C:\Users\Fares\Downloads\PMS
claude -p "Read supabase/migrations/20260220000001_agents_system.sql and execute it against the database using Supabase MCP. Break into individual statements. Use DO $$ BEGIN and EXCEPTION blocks for IF NOT EXISTS on types. Use CREATE OR REPLACE for functions. After running verify tables exist: agents, agent_activities, ai_models, agent_decisions." --allowedTools "mcp__supabase,Read"
