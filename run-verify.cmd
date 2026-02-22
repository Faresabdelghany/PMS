@echo off
cd /d C:\Users\Fares\Downloads\PMS
claude -p "Use Supabase MCP to list all tables in the database. Show me the agents, agent_activities, ai_models, and agent_decisions tables with their columns. Also check that tasks table has an agent_id column." --allowedTools "mcp__supabase"
