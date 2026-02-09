"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  FolderIcon,
  CheckSquareIcon,
  UsersIcon,
  HomeIcon,
  SettingsIcon,
  PlusIcon,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { globalSearch, type SearchResult } from "@/lib/actions/search"
import { useOrganization } from "@/hooks/use-organization"

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateProject?: () => void
  onCreateTask?: () => void
  onOpenSettings?: () => void
}

// Hoisted empty results object to prevent re-renders
const EMPTY_RESULTS: {
  projects: SearchResult[]
  tasks: SearchResult[]
  clients: SearchResult[]
} = { projects: [], tasks: [], clients: [] }

export function CommandPalette({ open, onOpenChange, onCreateProject, onCreateTask, onOpenSettings }: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState(EMPTY_RESULTS)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { organization } = useOrganization()

  // Search when query changes
  useEffect(() => {
    if (!query || query.length < 2 || !organization) {
      setResults(EMPTY_RESULTS)
      return
    }

    const timeoutId = setTimeout(() => {
      startTransition(async () => {
        const result = await globalSearch(organization.id, query)
        if (result.data) {
          setResults(result.data)
        }
      })
    }, 200) // Debounce

    return () => clearTimeout(timeoutId)
  }, [query, organization])

  const runCommand = useCallback((command: () => void) => {
    onOpenChange(false)
    setQuery("")
    command()
  }, [onOpenChange])

  const navigate = useCallback(
    (url: string) => {
      runCommand(() => router.push(url))
    },
    [router, runCommand]
  )

  const hasResults =
    results.projects.length > 0 ||
    results.tasks.length > 0 ||
    results.clients.length > 0

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search projects, tasks, clients..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isPending ? "Searching..." : "No results found."}
        </CommandEmpty>

        {/* Search Results */}
        {hasResults && (
          <>
            {results.projects.length > 0 && (
              <CommandGroup heading="Projects">
                {results.projects.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`project-${item.id}-${item.title}`}
                    onSelect={() => navigate(item.url)}
                    className="command-item-optimized"
                  >
                    <FolderIcon className="size-4 text-blue-500" />
                    <span>{item.title}</span>
                    {item.subtitle && (
                      <span className="text-muted-foreground text-xs ml-2">
                        {item.subtitle}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.tasks.length > 0 && (
              <CommandGroup heading="Tasks">
                {results.tasks.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`task-${item.id}-${item.title}`}
                    onSelect={() => navigate(item.url)}
                    className="command-item-optimized"
                  >
                    <CheckSquareIcon className="size-4 text-green-500" />
                    <span>{item.title}</span>
                    {item.subtitle && (
                      <span className="text-muted-foreground text-xs ml-2">
                        {item.subtitle}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.clients.length > 0 && (
              <CommandGroup heading="Clients">
                {results.clients.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`client-${item.id}-${item.title}`}
                    onSelect={() => navigate(item.url)}
                    className="command-item-optimized"
                  >
                    <UsersIcon className="size-4 text-purple-500" />
                    <span>{item.title}</span>
                    {item.subtitle && (
                      <span className="text-muted-foreground text-xs ml-2">
                        {item.subtitle}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator />
          </>
        )}

        {/* Quick Actions - always visible */}
        <CommandGroup heading="Quick Actions">
          {onCreateProject && (
            <CommandItem onSelect={() => runCommand(onCreateProject)}>
              <PlusIcon className="size-4" />
              <span>Create New Project</span>
              <CommandShortcut>⌘N</CommandShortcut>
            </CommandItem>
          )}
          {onCreateTask && (
            <CommandItem onSelect={() => runCommand(onCreateTask)}>
              <PlusIcon className="size-4" />
              <span>Create New Task</span>
              <CommandShortcut>⌘⇧N</CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => navigate("/projects")}>
            <HomeIcon className="size-4" />
            <span>Go to Projects</span>
            <CommandShortcut>G P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigate("/tasks")}>
            <CheckSquareIcon className="size-4" />
            <span>Go to My Tasks</span>
            <CommandShortcut>G T</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigate("/clients")}>
            <UsersIcon className="size-4" />
            <span>Go to Clients</span>
            <CommandShortcut>G C</CommandShortcut>
          </CommandItem>
          {onOpenSettings && (
            <CommandItem onSelect={() => runCommand(onOpenSettings)}>
              <SettingsIcon className="size-4" />
              <span>Go to Settings</span>
              <CommandShortcut>G S</CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

/**
 * Hook to programmatically open the command palette
 * Can be used from anywhere in the app
 */
export function useCommandPalette() {
  const open = useCallback(() => {
    // Dispatch a keyboard event to toggle the command palette
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)
  }, [])

  return { open }
}
