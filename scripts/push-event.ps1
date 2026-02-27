param(
  [Parameter(Mandatory=$true)] [string]$EventType,
  [Parameter(Mandatory=$true)] [string]$Message,
  [Parameter(Mandatory=$true)] [string]$AgentId,
  [string]$OrgId = "9c52b861-abb7-4774-9b5b-3fa55c8392cb",
  [string]$TaskId,
  [string]$TaskName,
  [string]$TaskDescription,
  [string]$ProjectId,
  [string]$ParentTaskId,
  [string]$Source = "agent",
  [string]$AssignedAgentId,
  [string]$Priority = "medium"
)

$eventPayload = @{}
if ($EventType -in @("task_create", "subtask_create")) {
  if (-not $TaskName -or -not $ProjectId) {
    throw "task_create/subtask_create require -TaskName and -ProjectId"
  }

  $eventPayload.name = $TaskName
  $eventPayload.description = $TaskDescription
  $eventPayload.project_id = $ProjectId
  $eventPayload.source = $Source
  $eventPayload.priority = $Priority
  if ($AssignedAgentId) { $eventPayload.assigned_agent_id = $AssignedAgentId }
  if ($ParentTaskId) { $eventPayload.parent_task_id = $ParentTaskId }
}

$body = @{
  org_id = $OrgId
  agent_id = $AgentId
  task_id = $TaskId
  event_type = $EventType
  message = $Message
  payload = $eventPayload
}

$serviceRole = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $serviceRole) {
  throw "SUPABASE_SERVICE_ROLE_KEY env var is required"
}

$resp = Invoke-RestMethod -Method Post -Uri "https://pms-nine-gold.vercel.app/api/agent-events" -Headers @{
  Authorization = "Bearer $serviceRole"
  "Content-Type" = "application/json"
} -Body ($body | ConvertTo-Json -Depth 10)

if ($resp.task_id) {
  Write-Host "Event pushed. Created task_id: $($resp.task_id)"
} else {
  Write-Host "Event pushed."
}
