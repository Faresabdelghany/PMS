"use client";

import { useState, useEffect, useCallback } from "react";
import { MotionDiv, AnimatePresence } from "@/components/ui/motion-lazy";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Stepper } from "./Stepper";
import { ProjectData, ProjectMode } from "./types";
import { StepMode } from "./steps/StepMode";
import { StepIntent } from "./steps/StepIntent";
import { StepOutcome } from "./steps/StepOutcome";
import { StepOwnership, type OrganizationMember } from "./steps/StepOwnership";
import { StepStructure } from "./steps/StepStructure";
import { StepReview } from "./steps/StepReview";
import { StepQuickCreate, type QuickCreateProjectData } from "./steps/StepQuickCreate";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { createProject } from "@/lib/actions/projects";
import { getOrganizationMembers } from "@/lib/actions/organizations";
import { useUser } from "@/hooks/use-user";

const QUICK_CREATE_STEP = 100;

// Stable empty array reference to prevent re-renders
const EMPTY_CLIENTS: { id: string; name: string }[] = [];

// Stable default project data
const DEFAULT_PROJECT_DATA: ProjectData = {
  mode: undefined,
  successType: 'undefined',
  deliverables: [],
  metrics: [],
  description: '',
  deadlineType: 'none',
  contributorIds: [],
  stakeholderIds: [],
  addStarterTasks: false,
};

interface ProjectWizardProps {
  onClose: () => void;
  onCreate?: () => void;
  organizationId?: string;
  clients?: { id: string; name: string }[];
}

export function ProjectWizard({ onClose, onCreate, organizationId, clients = EMPTY_CLIENTS }: ProjectWizardProps) {
  const { user } = useUser();
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState(0);
  const [maxStepReached, setMaxStepReached] = useState(0);
  const [isQuickCreateExpanded, setIsQuickCreateExpanded] = useState(false);
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMember[]>([]);
  const [data, setData] = useState<ProjectData>(() => ({ ...DEFAULT_PROJECT_DATA }));

  // Fetch organization members on mount
  useEffect(() => {
    async function fetchMembers() {
      if (!organizationId) return;
      const result = await getOrganizationMembers(organizationId);
      if (result.data) {
        setOrganizationMembers(result.data as OrganizationMember[]);
      }
    }
    fetchMembers();
  }, [organizationId]);

  // Keyboard navigation: Escape to close wizard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Step 0 is Mode Selection. It's separate from the numbered stepper.
  // The numbered stepper starts at Step 1 (Intent).
  // Internally:
  // 0: Mode
  // 1: Intent
  // 2: Outcome
  // 3: Ownership
  // 4: Structure
  // 5: Review

  const updateData = useCallback((updates: Partial<ProjectData>) => {
    setData(prev => ({ ...prev, ...updates }));
  }, []);

  const nextStep = useCallback(() => {
    if (step === 0 && data.mode === 'quick') {
      setStep(QUICK_CREATE_STEP); // Magic number for Quick Create View
      return;
    }

    setStep(prev => {
      const next = prev + 1;
      setMaxStepReached(m => Math.max(m, next));
      return next;
    });
  }, [step, data.mode]);

  const prevStep = useCallback(() => {
    setStep(prev => prev - 1);
  }, []);

  const jumpToStep = useCallback((s: number) => {
    // Adjust because stepper index 0 maps to internal step 1
    setStep(s + 1);
  }, []);

  const handleEditStepFromReview = useCallback((targetStep: number) => {
    // targetStep uses the internal step index (1-4)
    setStep(targetStep);
  }, []);

  const isNextDisabled = useCallback(() => {
    if (step === 3 && !data.ownerId) return true; // Step 3: Ownership
    return false;
  }, [step, data.ownerId]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Define steps for the stepper (excluding Mode selection)
  const steps = [
    "Project intent",
    "Outcome & success",
    "Ownership",
    "Work structure",
    "Review & create"
  ];

  const stepTitles: Record<number, string> = {
    1: "What is this project mainly about?",
    2: "How do you define success?",
    3: "Who is responsible for this project?",
    4: "How should this project be structured?",
    5: "Review project setup",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <MotionDiv 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ 
            opacity: 1, 
            scale: 1,
            height: step === QUICK_CREATE_STEP 
                ? (isQuickCreateExpanded ? "85vh" : "auto") 
                : "auto"
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={cn(
            "flex w-full max-w-[900px] overflow-hidden rounded-[24px] bg-background shadow-2xl"
        )}
      >
        {step === 0 ? (
             <StepMode 
                selected={data.mode} 
                onSelect={(m) => updateData({ mode: m })} 
                onContinue={nextStep}
                onCancel={handleClose}
                onClose={handleClose}
             />
        ) : step === QUICK_CREATE_STEP ? (
            <StepQuickCreate
                onClose={handleClose}
                clients={clients}
                organizationMembers={organizationMembers}
                onCreate={async (projectData: QuickCreateProjectData) => {
                  if (!organizationId) {
                    toast.error("Organization not found. Please log in again.");
                    return;
                  }

                  setIsCreating(true);
                  try {
                    const result = await createProject(organizationId, {
                      name: projectData.name,
                      description: projectData.description || null,
                      status: projectData.status,
                      priority: projectData.priority,
                      start_date: projectData.start_date || null,
                      end_date: projectData.end_date || null,
                      client_id: projectData.client_id || null,
                      type_label: projectData.type_label || null,
                      tags: projectData.tags || [],
                    });

                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }

                    onCreate?.();
                    toast.success("Project created successfully");
                    onClose();
                  } catch (error) {
                    toast.error("Failed to create project");
                  } finally {
                    setIsCreating(false);
                  }
                }}
                onExpandChange={setIsQuickCreateExpanded}
            />
        ) : (
            <>
                {/* Left Sidebar (Stepper) */}
                <div className="hidden w-64 border-r border-border bg-background px-6 py-7 md:flex md:flex-col md:gap-7">
                  <div>
                    <p className="text-sm font-semibold text-foreground">New Project</p>
                  </div>
                  <Stepper 
                    currentStep={step - 1} 
                    steps={steps} 
                    onStepClick={jumpToStep}
                    maxStepReached={maxStepReached - 1}
                  />
                </div>

                {/* Main Content */}
                <div className="flex flex-1 flex-col">
                    {/* Header: Title + Close button */}
                    <div className="flex items-start justify-between px-8 pt-6 pb-4">
                        <div className="pr-6">
                          {stepTitles[step] && (
                            <h2 className="text-lg font-semibold tracking-tight">
                              {stepTitles[step]}
                            </h2>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={handleClose}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto px-8 pb-8 pt-0">
                        <AnimatePresence mode="wait">
                            <MotionDiv
                                key={step}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="h-full"
                            >
                                {step === 1 && (
                                    <StepIntent selected={data.intent} onSelect={(i) => updateData({ intent: i })} />
                                )}
                                {step === 2 && (
                                    <StepOutcome data={data} updateData={updateData} />
                                )}
                                {step === 3 && (
                                    <StepOwnership
                                      data={data}
                                      updateData={updateData}
                                      currentUserId={user?.id}
                                      organizationMembers={organizationMembers}
                                      clients={clients}
                                    />
                                )}
                                {step === 4 && (
                                    <StepStructure data={data} updateData={updateData} />
                                )}
                                {step === 5 && (
                                    <StepReview data={data} updateData={updateData} onEditStep={handleEditStepFromReview} />
                                )}
                            </MotionDiv>
                        </AnimatePresence>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between bg-background p-6">
                        <div>
                            <Button variant="outline" onClick={prevStep}>
                                <CaretLeft className=" h-4 w-4" />
                                Back
                            </Button>
                        </div>

                        <div className="flex gap-3">
                            {step === 5 ? (
                                <>
                                    <Button variant="outline">Save as template</Button>
                                    <Button
                                      disabled={isCreating}
                                      onClick={async () => {
                                        if (!organizationId) {
                                          toast.error("Organization not found. Please log in again.");
                                          return;
                                        }

                                        setIsCreating(true);
                                        try {
                                          // Build project data from guided wizard state
                                          const projectName = data.name || data.deliverables[0]?.title || "Untitled Project";
                                          const result = await createProject(organizationId, {
                                            name: projectName,
                                            description: data.description || null,
                                            status: "planned",
                                            priority: "medium",
                                            intent: data.intent || null,
                                            success_type: data.successType === 'undefined' ? null : data.successType,
                                            deadline_type: data.deadlineType,
                                            deadline_date: data.deadlineDate || null,
                                            work_structure: data.structure || null,
                                            client_id: data.clientId || null,
                                            deliverables: data.deliverables.map((d) => ({
                                              title: d.title,
                                              due_date: d.dueDate || null,
                                            })),
                                            metrics: data.metrics?.map((m) => ({
                                              name: m.name,
                                              target: m.target || null,
                                            })) || [],
                                            owner_id: data.ownerId,
                                            contributor_ids: data.contributorIds,
                                            stakeholder_ids: data.stakeholderIds,
                                          });

                                          if (result.error) {
                                            toast.error(result.error);
                                            return;
                                          }

                                          onCreate?.();
                                          toast.success("Project created successfully");
                                          onClose();
                                        } catch (error) {
                                          toast.error("Failed to create project");
                                        } finally {
                                          setIsCreating(false);
                                        }
                                      }}
                                    >
                                      {isCreating ? "Creating..." : "Create project"}
                                    </Button>
                                </>
                            ) : (
                                <Button 
                                    onClick={nextStep} 
                                    disabled={isNextDisabled()}
                                >
                                    Next
                                    <CaretRight className=" h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </>
        )}
      </MotionDiv>
    </div>
  );
}
