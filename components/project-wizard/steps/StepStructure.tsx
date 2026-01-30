import { useState } from "react";
import { ProjectData, WorkStructure, GeneratedTask } from "../types";
import { cn } from "@/lib/utils";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { ArrowRight, Flag, GitMerge, Plus, X } from "@phosphor-icons/react/dist/ssr";
import { useAIStatus } from "@/hooks/use-ai-status";
import { AIGenerateButton } from "@/components/ai/ai-generate-button";
import { AISetupPrompt } from "@/components/ai/ai-setup-prompt";
import { AITaskPreview } from "@/components/ai/ai-task-preview";
import { generateWorkstreams, generateTasks, type ProjectContext } from "@/lib/actions/ai";

// Simple Toggle component
function SimpleToggle({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (c: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input"
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

interface StepStructureProps {
  data: ProjectData;
  updateData: (updates: Partial<ProjectData>) => void;
}

export function StepStructure({ data, updateData }: StepStructureProps) {
  const { isConfigured, refetch: refetchAIStatus } = useAIStatus();
  const [isGeneratingWorkstreams, setIsGeneratingWorkstreams] = useState(false);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [newWorkstream, setNewWorkstream] = useState("");
  const [showTaskToggle, setShowTaskToggle] = useState(data.generatedTasks.length > 0);

  const structures: { id: WorkStructure; title: string; desc: string; icon: React.ReactNode; visual: React.ReactNode }[] = [
    {
      id: 'linear',
      title: 'Linear',
      desc: 'Sequential phases (e.g. Waterfall). One thing after another.',
      icon: <ArrowRight className="h-5 w-5" />,
      visual: (
        <div className="flex items-center gap-2 opacity-50">
          <div className="h-2 w-8 rounded bg-current"></div>
          <ArrowRight className="h-3 w-3" />
          <div className="h-2 w-8 rounded bg-current"></div>
          <ArrowRight className="h-3 w-3" />
          <div className="h-2 w-8 rounded bg-current"></div>
        </div>
      )
    },
    {
      id: 'milestones',
      title: 'Milestones',
      desc: 'Key checkpoints or deadlines to hit along the way.',
      icon: <Flag className="h-5 w-5" />,
      visual: (
        <div className="flex items-center justify-between gap-1 opacity-50">
          <div className="h-2 w-2 rounded-full bg-current"></div>
          <div className="h-0.5 flex-1 bg-current"></div>
          <Flag className="h-3 w-3" />
          <div className="h-0.5 flex-1 bg-current"></div>
          <div className="h-2 w-2 rounded-full bg-current"></div>
        </div>
      )
    },
    {
      id: 'multistream',
      title: 'Multi-stream',
      desc: 'Parallel tracks of work happening simultaneously.',
      icon: <GitMerge className="h-5 w-5" />,
      visual: (
        <div className="flex flex-col gap-1 opacity-50">
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-4 bg-current"></div>
            <div className="h-1.5 w-6 rounded bg-current"></div>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-4 bg-current"></div>
            <div className="h-1.5 w-6 rounded bg-current"></div>
          </div>
        </div>
      )
    }
  ];

  const handleGenerateWorkstreams = async () => {
    setIsGeneratingWorkstreams(true);
    try {
      const context: ProjectContext = {
        name: data.name || "Untitled Project",
        description: data.description,
      };

      const result = await generateWorkstreams(context, 4);

      if (result.error) {
        console.error("Workstream generation error:", result.error);
        return;
      }

      if (result.data) {
        const workstreamNames = result.data.map((ws) => ws.name);
        updateData({ workstreams: workstreamNames });
      }
    } catch (error) {
      console.error("Workstream generation failed:", error);
    } finally {
      setIsGeneratingWorkstreams(false);
    }
  };

  const handleGenerateTasks = async () => {
    setIsGeneratingTasks(true);
    setShowTaskToggle(true);
    try {
      const context: ProjectContext = {
        name: data.name || "Untitled Project",
        description: data.description,
        existingWorkstreams: data.workstreams,
      };

      const result = await generateTasks(context, 5);

      if (result.error) {
        console.error("Task generation error:", result.error);
        return;
      }

      if (result.data) {
        const generatedTasks: GeneratedTask[] = result.data.map((task, index) => ({
          id: `gen-${Date.now()}-${index}`,
          title: task.title,
          description: task.description,
          priority: task.priority as "low" | "medium" | "high",
          workstream: data.workstreams.length > 0 ? data.workstreams[index % data.workstreams.length] : undefined,
          included: true,
        }));
        updateData({ generatedTasks });
      }
    } catch (error) {
      console.error("Task generation failed:", error);
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const handleAISetupComplete = (action: "workstreams" | "tasks") => {
    refetchAIStatus();
    setTimeout(() => {
      if (action === "workstreams") {
        handleGenerateWorkstreams();
      } else {
        handleGenerateTasks();
      }
    }, 100);
  };

  const addWorkstream = () => {
    if (!newWorkstream.trim()) return;
    updateData({ workstreams: [...data.workstreams, newWorkstream.trim()] });
    setNewWorkstream("");
  };

  const removeWorkstream = (ws: string) => {
    updateData({ workstreams: data.workstreams.filter((w) => w !== ws) });
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* Work Structure Selection */}
      <div className="space-y-4 bg-muted p-2 rounded-3xl">
        <p className="text-sm text-muted-foreground px-4 pt-2">Choose the workflow that fits your team best.</p>

        <div className="grid gap-1">
          {structures.map((option) => (
            <div
              key={option.id}
              onClick={() => updateData({ structure: option.id })}
              className={cn(
                "relative flex cursor-pointer items-center space-x-4 rounded-3xl border-2 p-4 transition-all bg-background",
                data.structure === option.id
                  ? "border-primary ring-1 ring-primary/20"
                  : "border-muted"
              )}
            >
              <div className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
                data.structure === option.id ? "bg-background border border-border text-primary" : "bg-background border border-border text-muted-foreground"
              )}>
                {option.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between space-y-1">
                  <h3 className="font-medium">{option.title}</h3>
                  <div className="text-muted-foreground/50">{option.visual}</div>
                </div>
                <p className="text-sm text-muted-foreground">{option.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workstreams Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Workstreams</Label>
            <p className="text-sm text-muted-foreground">Organize work into parallel tracks.</p>
          </div>
          {isConfigured ? (
            <AIGenerateButton
              onClick={handleGenerateWorkstreams}
              isLoading={isGeneratingWorkstreams}
              label="Suggest"
              loadingLabel="Suggesting..."
              size="sm"
            />
          ) : (
            <AISetupPrompt onSetupComplete={() => handleAISetupComplete("workstreams")}>
              <AIGenerateButton onClick={() => {}} label="Suggest" size="sm" />
            </AISetupPrompt>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {data.workstreams.map((ws) => (
            <div
              key={ws}
              className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5"
            >
              <span className="text-sm">{ws}</span>
              <button
                type="button"
                onClick={() => removeWorkstream(ws)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}

          <div className="flex items-center gap-1">
            <Input
              value={newWorkstream}
              onChange={(e) => setNewWorkstream(e.target.value)}
              placeholder="Add workstream"
              className="h-8 w-32 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addWorkstream();
                }
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={addWorkstream}
              disabled={!newWorkstream.trim()}
              className="h-8 w-8"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Starter Tasks Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Starter Tasks</Label>
            <p className="text-sm text-muted-foreground">
              Generate initial tasks to get started quickly.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SimpleToggle
              checked={showTaskToggle}
              onCheckedChange={(c) => {
                setShowTaskToggle(c);
                if (!c) {
                  updateData({ generatedTasks: [] });
                }
              }}
            />
            {showTaskToggle && (
              isConfigured ? (
                <AIGenerateButton
                  onClick={handleGenerateTasks}
                  isLoading={isGeneratingTasks}
                  label="Generate"
                  loadingLabel="Generating..."
                  size="sm"
                />
              ) : (
                <AISetupPrompt onSetupComplete={() => handleAISetupComplete("tasks")}>
                  <AIGenerateButton onClick={() => {}} label="Generate" size="sm" />
                </AISetupPrompt>
              )
            )}
          </div>
        </div>

        {showTaskToggle && data.generatedTasks.length > 0 && (
          <AITaskPreview
            tasks={data.generatedTasks}
            workstreams={data.workstreams}
            onTasksChange={(tasks) => updateData({ generatedTasks: tasks })}
            onRegenerate={handleGenerateTasks}
            isRegenerating={isGeneratingTasks}
          />
        )}
      </div>
    </div>
  );
}
