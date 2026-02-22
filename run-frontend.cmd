@echo off
cd /d C:\Users\Fares\Downloads\PMS
set /p PROMPT=<frontend-task.txt
claude -p "%PROMPT%" --allowedTools "Read,Write,Edit,Bash" --strict-mcp-config --mcp-config empty-mcp.json
