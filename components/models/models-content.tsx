"use client"

import { useState, useTransition } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { type AgentModel, updateAgentModel } from "@/lib/actions/models"
import { type ModelTier, AVAILABLE_MODELS, getModelTier } from "@/lib/constants/models"
import { useRouter } from "next/navigation"

const formSchema = z.object({
  model: z.string().min(1, "Select a model"),
})

function TierBadge({ tier }: { tier: ModelTier }) {
  const variant = tier === "Free" ? "secondary" : tier === "Premium" ? "outline" : "default"
  return <Badge variant={variant}>{tier}</Badge>
}

function ModelLabel({ model }: { model: string | null }) {
  if (!model) return <span className="text-muted-foreground">Not set</span>
  const found = AVAILABLE_MODELS.find((m) => m.value === model)
  return <span>{found?.label ?? model}</span>
}

interface ModelsContentProps {
  agents: AgentModel[]
}

export function ModelsContent({ agents }: ModelsContentProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentModel | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const tierCounts = agents.reduce(
    (acc, a) => {
      const tier = getModelTier(a.model)
      acc[tier] = (acc[tier] || 0) + 1
      return acc
    },
    {} as Record<ModelTier, number>
  )

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { model: "" },
  })

  function openSheet(agent: AgentModel) {
    setSelectedAgent(agent)
    form.reset({ model: agent.model ?? "" })
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!selectedAgent) return
    startTransition(async () => {
      const result = await updateAgentModel(selectedAgent.id, values.model)
      if (!result.error) {
        setSelectedAgent(null)
        router.refresh()
      }
    })
  }

  return (
    <>
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 p-4">
        {(["Free", "Standard", "Premium"] as ModelTier[]).map((tier) => (
          <Card key={tier}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{tier}</span>
                <TierBadge tier={tier} />
              </div>
              <p className="mt-1 text-2xl font-semibold">{tierCounts[tier] ?? 0}</p>
              <p className="text-xs text-muted-foreground">agents</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => (
              <TableRow
                key={agent.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => openSheet(agent)}
              >
                <TableCell className="font-medium">{agent.name}</TableCell>
                <TableCell className="text-muted-foreground">{agent.role}</TableCell>
                <TableCell><ModelLabel model={agent.model} /></TableCell>
                <TableCell><TierBadge tier={getModelTier(agent.model)} /></TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{agent.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Sheet */}
      <Sheet open={!!selectedAgent} onOpenChange={(open) => !open && setSelectedAgent(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Model — {selectedAgent?.name}</SheetTitle>
            <SheetDescription>
              Change the AI model assigned to this agent.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a model" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {AVAILABLE_MODELS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              <span className="flex items-center gap-2">
                                {m.label}
                                <TierBadge tier={m.tier} />
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving…" : "Save"}
                </Button>
              </form>
            </Form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
