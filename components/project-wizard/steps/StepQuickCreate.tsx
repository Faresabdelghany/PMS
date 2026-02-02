import React, { useState, useRef, useEffect, useMemo } from "react";
import { AnimatePresence } from "@/components/ui/motion-lazy";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar } from "../../ui/calendar";
import { Button } from "../../ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../ui/command";
import { Check, X, CornersOut, Star, CalendarBlank, UserCircle, Spinner, List, Paperclip, Microphone, Rows, ChartBar, Tag, SquaresFour, Bookmark } from "@phosphor-icons/react/dist/ssr";
import { ProjectDescriptionEditorLazy as ProjectDescriptionEditor } from "../ProjectDescriptionEditorLazy";
import type { ProjectStatus, ProjectPriority, OrganizationTag, OrganizationLabel } from "@/lib/supabase/types";
import type { OrganizationMember } from "./StepOwnership";

type Client = { id: string; name: string };

type LabelOption = { id: string; label: string; color?: string };

export type QuickCreateProjectData = {
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  start_date?: string;
  end_date?: string;
  client_id?: string;
  type_label?: string;
  tags?: string[];
  owner_id?: string;
  group_label?: string;
  label_badge?: string;
};

// Type for editing an existing project
export type EditingProjectData = {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  start_date?: string | null;
  end_date?: string | null;
  client_id?: string | null;
  client?: { id: string; name: string } | null;
  type_label?: string | null;
  tags?: string[];
  owner_id?: string | null;
  group_label?: string | null;
  label_badge?: string | null;
  members?: Array<{
    user_id: string;
    role: string;
    profile: { id: string; full_name: string | null; email: string; avatar_url: string | null };
  }>;
};

// --- Static Options (not user data) ---

const STATUSES = [
  { id: "backlog", label: "Backlog", dotClass: "bg-orange-600" },
  { id: "todo", label: "Todo", dotClass: "bg-neutral-300" },
  { id: "in-progress", label: "In Progress", dotClass: "bg-yellow-400" },
  { id: "done", label: "Done", dotClass: "bg-green-600" },
  { id: "canceled", label: "Canceled", dotClass: "bg-neutral-400" },
];

const PRIORITIES = [
  { id: "no-priority", label: "No Priority", icon: "BarChart" },
  { id: "urgent", label: "Urgent", icon: "AlertCircle" },
  { id: "high", label: "High", icon: "ArrowUp" },
  { id: "medium", label: "Medium", icon: "ArrowRight" },
  { id: "low", label: "Low", icon: "ArrowDown" },
];

const WORKSTREAMS = [
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "design", label: "Design" },
  { id: "qa", label: "QA" },
];

// --- Helper Components ---

function Wrapper({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn("relative shrink-0 size-[16px]", className)}
    >
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        {children}
      </svg>
    </div>
  );
}


// --- Pickers ---

interface PickerProps<T> {
  trigger: React.ReactNode;
  items: T[];
  onSelect: (item: T) => void;
  selectedId?: string;
  placeholder?: string;
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
}

export function GenericPicker<
  T extends { id: string; label?: string; name?: string },
>({
  trigger,
  items,
  onSelect,
  selectedId,
  placeholder = "Search...",
  renderItem,
}: PickerProps<T>) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="p-0 w-[240px]" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.label || item.name || item.id}
                  onSelect={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  {renderItem(item, item.id === selectedId)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface DatePickerProps {
  date?: Date;
  onSelect: (date: Date | undefined) => void;
  trigger: React.ReactNode;
}

export function DatePicker({
  date,
  onSelect,
  trigger,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            onSelect(d);
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// --- Main Component ---

interface StepQuickCreateProps {
  onClose: () => void;
  onCreate: (data: QuickCreateProjectData) => void;
  onUpdate?: (projectId: string, data: QuickCreateProjectData) => void;
  onExpandChange?: (isExpanded: boolean) => void;
  clients?: Client[];
  organizationMembers?: OrganizationMember[];
  tags?: OrganizationTag[];
  labels?: OrganizationLabel[];
  editingProject?: EditingProjectData | null;
}

export function StepQuickCreate({
  onClose,
  onCreate,
  onUpdate,
  onExpandChange,
  clients = [],
  organizationMembers = [],
  tags = [],
  labels = [],
  editingProject,
}: StepQuickCreateProps) {
  const isEditing = !!editingProject;

  // Filter labels by category for pickers
  const typeLabels = useMemo(() =>
    labels.filter(l => l.category === 'type').map(l => ({ id: l.id, label: l.name, color: l.color })),
    [labels]
  );
  const durationLabels = useMemo(() =>
    labels.filter(l => l.category === 'duration').map(l => ({ id: l.id, label: l.name, color: l.color })),
    [labels]
  );
  const groupLabels = useMemo(() =>
    labels.filter(l => l.category === 'group').map(l => ({ id: l.id, label: l.name, color: l.color })),
    [labels]
  );
  const badgeLabels = useMemo(() =>
    labels.filter(l => l.category === 'badge').map(l => ({ id: l.id, label: l.name, color: l.color })),
    [labels]
  );

  // Fallback to hardcoded options if no labels configured
  const FALLBACK_TYPES: LabelOption[] = [
    { id: "design", label: "Design Sprint" },
    { id: "dev", label: "Dev Sprint" },
    { id: "planning", label: "Planning" },
  ];
  const FALLBACK_GROUPS: LabelOption[] = [
    { id: "general", label: "General" },
    { id: "development", label: "Development" },
    { id: "design", label: "Design" },
    { id: "marketing", label: "Marketing" },
    { id: "operations", label: "Operations" },
    { id: "research", label: "Research" },
  ];
  const FALLBACK_BADGES: LabelOption[] = [
    { id: "project", label: "Project" },
    { id: "feature", label: "Feature" },
    { id: "bug-fix", label: "Bug Fix" },
    { id: "improvement", label: "Improvement" },
    { id: "maintenance", label: "Maintenance" },
    { id: "experiment", label: "Experiment" },
  ];

  // Use database labels if available, otherwise fallback
  const effectiveTypeLabels = typeLabels.length > 0 ? typeLabels : FALLBACK_TYPES;
  const effectiveGroupLabels = groupLabels.length > 0 ? groupLabels : FALLBACK_GROUPS;
  const effectiveBadgeLabels = badgeLabels.length > 0 ? badgeLabels : FALLBACK_BADGES;

  // Convert org members to picker format (filter out members without profiles)
  const memberOptions = organizationMembers
    .filter((m) => m.profile !== null)
    .map((m) => ({
      id: m.user_id,
      name: m.profile!.full_name || m.profile!.email,
      avatar: m.profile!.avatar_url || "",
    }));

  // Helper to map Supabase status to UI status
  const mapSupabaseToUIStatus = (status: ProjectStatus) => {
    const mapping: Record<ProjectStatus, string> = {
      "backlog": "backlog",
      "planned": "todo",
      "active": "in-progress",
      "completed": "done",
      "cancelled": "canceled",
    };
    return STATUSES.find(s => s.id === mapping[status]) || STATUSES[1];
  };

  // Helper to find owner from project members
  const findOwnerFromMembers = () => {
    if (!editingProject?.members) return null;
    const ownerMember = editingProject.members.find(m => m.role === "owner" || m.role === "pic");
    if (!ownerMember) return null;
    const memberOption = memberOptions.find(m => m.id === ownerMember.user_id);
    return memberOption || null;
  };

  // Data State - initialize from editingProject if available
  const [title, setTitle] = useState(editingProject?.name || "");
  const [assignee, setAssignee] = useState<{ id: string; name: string; avatar: string } | null>(
    isEditing ? findOwnerFromMembers() : (memberOptions[0] || null)
  );
  const [startDate, setStartDate] = useState<Date | undefined>(
    editingProject?.start_date ? new Date(editingProject.start_date) : new Date()
  );
  const [status, setStatus] = useState(
    isEditing && editingProject?.status ? mapSupabaseToUIStatus(editingProject.status) : STATUSES[1]
  );
  const [sprintType, setSprintType] = useState<LabelOption | null>(null);
  const [targetDate, setTargetDate] = useState<Date | undefined>(
    editingProject?.end_date ? new Date(editingProject.end_date) : undefined
  );
  const [workstream, setWorkstream] = useState<(typeof WORKSTREAMS)[0] | null>(null);
  const [priority, setPriority] = useState<(typeof PRIORITIES)[0] | null>(
    editingProject?.priority
      ? PRIORITIES.find(p => p.id === editingProject.priority) || null
      : null
  );
  const [selectedTag, setSelectedTag] = useState<OrganizationTag | null>(null);
  const [client, setClient] = useState<Client | null>(
    editingProject?.client ? { id: editingProject.client.id, name: editingProject.client.name } : null
  );
  const [group, setGroup] = useState<LabelOption | null>(null);
  const [label, setLabel] = useState<LabelOption | null>(null);

  useEffect(() => {
    // Focus title on mount
    const timer = setTimeout(() => {
      const titleInput = document.getElementById(
        "quick-create-title",
      );
      if (titleInput) titleInput.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Update assignee when organizationMembers loads (for edit mode)
  useEffect(() => {
    if (isEditing && editingProject?.members && memberOptions.length > 0 && !assignee) {
      const ownerMember = editingProject.members.find(m => m.role === "owner" || m.role === "pic");
      if (ownerMember) {
        const memberOption = memberOptions.find(m => m.id === ownerMember.user_id);
        if (memberOption) {
          setAssignee(memberOption);
        }
      }
    }
  }, [isEditing, editingProject?.members, memberOptions, assignee]);

  // Initialize label states when editing and effective labels become available
  useEffect(() => {
    if (isEditing && editingProject) {
      // Initialize sprintType from type_label
      if (editingProject.type_label && !sprintType) {
        const found = effectiveTypeLabels.find(t => t.label === editingProject.type_label);
        if (found) setSprintType(found);
        else setSprintType({ id: "custom", label: editingProject.type_label });
      }
      // Initialize group from group_label
      if (editingProject.group_label && !group) {
        const found = effectiveGroupLabels.find(g => g.label === editingProject.group_label);
        if (found) setGroup(found);
        else setGroup({ id: "custom", label: editingProject.group_label });
      }
      // Initialize label from label_badge
      if (editingProject.label_badge && !label) {
        const found = effectiveBadgeLabels.find(l => l.label === editingProject.label_badge);
        if (found) setLabel(found);
        else setLabel({ id: "custom", label: editingProject.label_badge });
      }
    }
  }, [isEditing, editingProject, effectiveTypeLabels, effectiveGroupLabels, effectiveBadgeLabels, sprintType, group, label]);

  const mapStatusToSupabase = (statusId: string): ProjectStatus => {
    const mapping: Record<string, ProjectStatus> = {
      "backlog": "backlog",
      "todo": "planned",
      "in-progress": "active",
      "done": "completed",
      "canceled": "cancelled",
    };
    return mapping[statusId] || "planned";
  };

  const mapPriorityToSupabase = (priorityId: string | undefined): ProjectPriority => {
    if (!priorityId || priorityId === "no-priority") return "medium";
    return priorityId as ProjectPriority;
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      return;
    }

    const projectData: QuickCreateProjectData = {
      name: title.trim(),
      status: mapStatusToSupabase(status.id),
      priority: mapPriorityToSupabase(priority?.id),
      start_date: startDate ? startDate.toISOString().split('T')[0] : undefined,
      end_date: targetDate ? targetDate.toISOString().split('T')[0] : undefined,
      client_id: client?.id,
      type_label: sprintType?.label,
      tags: selectedTag ? [selectedTag.name] : [],
      owner_id: assignee?.id,
      group_label: group?.label,
      label_badge: label?.label,
    };

    if (isEditing && editingProject && onUpdate) {
      onUpdate(editingProject.id, projectData);
    } else {
      onCreate(projectData);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div
      className="bg-background relative rounded-3xl size-full font-sans overflow-hidden flex flex-col"
      onKeyDown={handleKeyDown}
    >
      {/* Close Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute right-4 top-3 opacity-70 hover:opacity-100 rounded-xl"
      >
        <X className="size-4 text-muted-foreground" />
      </Button>

      <div className="flex flex-col flex-1 p-3.5 px-4 gap-3.5 overflow-hidden">
        {/* Title Input */}
        <div className="flex flex-col gap-2 w-full shrink-0 mt-2">
          <div className="flex gap-1 h-10 items-center w-full">
            <input
              id="quick-create-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project title"
              className="w-full font-normal leading-7 text-foreground placeholder:text-muted-foreground text-xl outline-none bg-transparent border-none p-0"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Description Area (Tiptap) */}
        <ProjectDescriptionEditor onExpandChange={onExpandChange} />

        {/* Property Buttons - Interactive Dropdowns */}
        <div className="flex flex-wrap gap-2.5 items-start w-full shrink-0">
          {/* Owner Picker */}
          {memberOptions.length > 0 && (
            <GenericPicker
              items={memberOptions}
              onSelect={setAssignee}
              selectedId={assignee?.id}
              placeholder="Assign owner..."
              renderItem={(item, isSelected) => (
                <div className="flex items-center gap-2 w-full">
                  {item.avatar ? (
                    <img
                      src={item.avatar}
                      alt=""
                      className="size-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="size-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      {item.name.charAt(0)}
                    </div>
                  )}
                  <span className="flex-1">{item.name}</span>
                  {isSelected && <Check className="size-4" />}
                </div>
              )}
              trigger={
                <button className="bg-muted flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
                  <div className="relative rounded-full size-4 overflow-hidden">
                    {assignee?.avatar ? (
                      <img
                        alt=""
                        className="object-cover size-full"
                        src={assignee.avatar}
                      />
                    ) : (
                      <div className="bg-muted size-full flex items-center justify-center text-xs">
                        {assignee?.name.charAt(0) ?? "?"}
                      </div>
                    )}
                  </div>
                  <span className="font-medium text-foreground text-sm leading-5">
                    {assignee?.name ?? "Owner"}
                  </span>
                </button>
              }
            />
          )}

          {/* Start Date Picker */}
          <DatePicker
            date={startDate}
            onSelect={setStartDate}
            trigger={
              <button className="bg-muted flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:border-primary/50 transition-colors">
                <CalendarBlank className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground text-sm leading-5">
                  {startDate
                    ? `Start: ${format(startDate, "dd/MM/yyyy")}`
                    : "Start Date"}
                </span>
              </button>
            }
          />

          {/* Client Picker */}
          <GenericPicker
            items={clients}
            onSelect={setClient}
            selectedId={client?.id}
            placeholder="Assign client..."
            renderItem={(item, isSelected) => (
              <div className="flex items-center gap-2 w-full">
                <div className="size-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                  {item.name.charAt(0)}
                </div>
                <span className="flex-1">{item.name}</span>
                {isSelected && <Check className="size-4" />}
              </div>
            )}
            trigger={
              <button
                className={cn(
                  "flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border transition-colors",
                  client
                    ? "bg-muted"
                    : "bg-background hover:bg-black/5",
                )}
              >
                <UserCircle className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground text-sm leading-5">
                  {client ? client.name : "Client"}
                </span>
              </button>
            }
          />

          {/* Status Picker */}
          <GenericPicker
            items={STATUSES}
            onSelect={setStatus}
            selectedId={status.id}
            placeholder="Change status..."
            renderItem={(item, isSelected) => (
              <div className="flex items-center gap-2 w-full">
                <div className={cn("size-3 rounded-full", item.dotClass)} />
                <span className="flex-1">{item.label}</span>
                {isSelected && <Check className="size-4" />}
              </div>
            )}
            trigger={
              <button
                className={cn(
                  "flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border transition-colors",
                  "bg-background hover:bg-black/5",
                )}
              >
                <Wrapper>
                  <g
                    clipPath="url(#clip0_13_2475)"
                    id="Icon / Loader"
                  >
                  <Spinner className="size-4 text-muted-foreground" />
                  </g>
                  <defs>
                    <clipPath id="clip0_13_2475">
                      <rect
                        fill="white"
                        height="16"
                        width="16"
                      />
                    </clipPath>
                  </defs>
                </Wrapper>
                {status.id !== "backlog" && (
                  <div className={cn("size-2 rounded-full", (status as any).dotClass)} />
                )}
                <span className="font-medium text-foreground text-sm leading-5">
                  {status.label}
                </span>
              </button>
            }
          />

          {/* Sprint Type Picker */}
          <GenericPicker
            items={effectiveTypeLabels}
            onSelect={setSprintType}
            selectedId={sprintType?.id}
            placeholder="Select sprint type..."
            renderItem={(item, isSelected) => (
              <div className="flex items-center gap-2 w-full">
                {item.color && (
                  <div
                    className="size-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                )}
                <span className="flex-1">{item.label}</span>
                {isSelected && <Check className="size-4" />}
              </div>
            )}
            trigger={
              <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
                {sprintType?.color ? (
                  <div
                    className="size-3 rounded-full"
                    style={{ backgroundColor: sprintType.color }}
                  />
                ) : (
                  <List className="size-4 text-muted-foreground" />
                )}
                <span className="font-medium text-foreground text-sm leading-5">
                  {sprintType ? sprintType.label : "Sprint Type"}
                </span>
              </button>
            }
          />

          {/* Target Date Picker */}
          <DatePicker
            date={targetDate}
            onSelect={setTargetDate}
            trigger={
              <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
                <CalendarBlank className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground text-sm leading-5">
                  {targetDate
                    ? format(targetDate, "dd/MM/yyyy")
                    : "Target"}
                </span>
              </button>
            }
          />

          {/* Workstreams Picker */}
          <GenericPicker
            items={WORKSTREAMS}
            onSelect={setWorkstream}
            selectedId={workstream?.id}
            placeholder="Select workstream..."
            renderItem={(item, isSelected) => (
              <div className="flex items-center gap-2 w-full">
                <span className="flex-1">{item.label}</span>
                {isSelected && <Check className="size-4" />}
              </div>
            )}
            trigger={
              <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
                <Rows className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground text-sm leading-5">
                  {workstream
                    ? workstream.label
                    : "Workstreams"}
                </span>
              </button>
            }
          />

          {/* Priority Picker */}
          <GenericPicker
            items={PRIORITIES}
            onSelect={setPriority}
            selectedId={priority?.id}
            placeholder="Set priority..."
            renderItem={(item, isSelected) => (
              <div className="flex items-center gap-2 w-full">
                <span className="flex-1">{item.label}</span>
                {isSelected && <Check className="size-4" />}
              </div>
            )}
            trigger={
              <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
                <ChartBar className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground text-sm leading-5">
                  {priority ? priority.label : "Priority"}
                </span>
              </button>
            }
          />

          {/* Tag Picker */}
          {tags.length > 0 && (
            <GenericPicker
              items={tags}
              onSelect={setSelectedTag}
              selectedId={selectedTag?.id}
              placeholder="Add tag..."
              renderItem={(item, isSelected) => (
                <div className="flex items-center gap-2 w-full">
                  <div
                    className="size-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="flex-1">{item.name}</span>
                  {isSelected && <Check className="size-4" />}
                </div>
              )}
              trigger={
                <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
                  {selectedTag && (
                    <div
                      className="size-3 rounded-full"
                      style={{ backgroundColor: selectedTag.color }}
                    />
                  )}
                  {!selectedTag && <Tag className="size-4 text-muted-foreground" />}
                  <span className="font-medium text-foreground text-sm leading-5">
                    {selectedTag ? selectedTag.name : "Tag"}
                  </span>
                </button>
              }
            />
          )}

          {/* Group Picker */}
          <GenericPicker
            items={effectiveGroupLabels}
            onSelect={setGroup}
            selectedId={group?.id}
            placeholder="Select group..."
            renderItem={(item, isSelected) => (
              <div className="flex items-center gap-2 w-full">
                {item.color && (
                  <div
                    className="size-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                )}
                <span className="flex-1">{item.label}</span>
                {isSelected && <Check className="size-4" />}
              </div>
            )}
            trigger={
              <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
                {group?.color ? (
                  <div
                    className="size-3 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                ) : (
                  <SquaresFour className="size-4 text-muted-foreground" />
                )}
                <span className="font-medium text-foreground text-sm leading-5">
                  {group ? group.label : "Group"}
                </span>
              </button>
            }
          />

          {/* Label Picker */}
          <GenericPicker
            items={effectiveBadgeLabels}
            onSelect={setLabel}
            selectedId={label?.id}
            placeholder="Select label..."
            renderItem={(item, isSelected) => (
              <div className="flex items-center gap-2 w-full">
                {item.color && (
                  <div
                    className="size-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                )}
                <span className="flex-1">{item.label}</span>
                {isSelected && <Check className="size-4" />}
              </div>
            )}
            trigger={
              <button className="bg-background flex gap-2 h-9 items-center px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors">
                {label?.color ? (
                  <div
                    className="size-3 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                ) : (
                  <Bookmark className="size-4 text-muted-foreground" />
                )}
                <span className="font-medium text-foreground text-sm leading-5">
                  {label ? label.label : "Label"}
                </span>
              </button>
            }
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto w-full pt-4 shrink-0">
          <div className="flex items-center">
            <button className="flex items-center justify-center size-10 rounded-lg hover:bg-black/5 transition-colors cursor-pointer">
              <Paperclip className="size-4 text-muted-foreground" />
            </button>
            <button className="flex items-center justify-center size-10 rounded-lg hover:bg-black/5 transition-colors cursor-pointer">
              <Microphone className="size-4 text-muted-foreground" />
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex gap-3 h-10 items-center justify-center px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <span className="font-medium text-primary-foreground text-sm leading-5">
              {isEditing ? "Update Project" : "Create Project"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}