"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { StarFour } from "@phosphor-icons/react/dist/ssr/StarFour"
import { Eye } from "@phosphor-icons/react/dist/ssr/Eye"
import { EyeSlash } from "@phosphor-icons/react/dist/ssr/EyeSlash"
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { XCircle } from "@phosphor-icons/react/dist/ssr/XCircle"
import { CircleNotch } from "@phosphor-icons/react/dist/ssr/CircleNotch"
import { AI_MODELS, type AIProvider } from "@/lib/constants/ai"
import { saveAISettings, saveAIApiKey } from "@/lib/actions/user-settings"
import { testAIConnection } from "@/lib/actions/ai"

interface AISetupPromptProps {
  children: React.ReactNode
  onSetupComplete?: () => void
  className?: string
}

export function AISetupPrompt({ children, onSetupComplete, className }: AISetupPromptProps) {
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState<AIProvider>("openai")
  const [model, setModel] = useState<string>("gpt-4o-mini")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null)

  const models = provider ? AI_MODELS[provider] || [] : []

  const handleProviderChange = (value: string) => {
    const newProvider = value as AIProvider
    setProvider(newProvider)
    // Reset model to first option for new provider
    const newModels = AI_MODELS[value] || []
    setModel(newModels[0]?.value || "")
    setTestResult(null)
  }

  const handleTestConnection = async () => {
    if (!provider || !apiKey) return

    setIsTesting(true)
    setTestResult(null)

    try {
      // First save settings temporarily for test
      await saveAISettings({ ai_provider: provider, ai_model_preference: model })
      await saveAIApiKey(apiKey)

      const result = await testAIConnection()
      setTestResult(result.data?.success ? "success" : "error")
    } catch {
      setTestResult("error")
    } finally {
      setIsTesting(false)
    }
  }

  const handleSaveAndContinue = async () => {
    if (!provider || !apiKey) return

    setIsSaving(true)
    try {
      await saveAISettings({ ai_provider: provider, ai_model_preference: model })
      await saveAIApiKey(apiKey)
      setOpen(false)
      onSetupComplete?.()
    } catch {
      // Error handling
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild className={className}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <StarFour weight="fill" className="size-4 text-violet-500" />
            <span className="font-medium text-sm">Set up AI to unlock this feature</span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Provider</Label>
                <Select value={provider || ""} onValueChange={handleProviderChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Model</Label>
                <Select value={model} onValueChange={setModel} disabled={!provider}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">API Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    setTestResult(null)
                  }}
                  placeholder="sk-..."
                  className="h-8 pr-8 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={!provider || !apiKey || isTesting}
              className="h-7 text-xs"
            >
              {isTesting ? (
                <>
                  <CircleNotch className="size-3 animate-spin mr-1" />
                  Testing...
                </>
              ) : testResult === "success" ? (
                <>
                  <CheckCircle className="size-3 text-green-500 mr-1" />
                  Connected
                </>
              ) : testResult === "error" ? (
                <>
                  <XCircle className="size-3 text-red-500 mr-1" />
                  Failed
                </>
              ) : (
                "Test Connection"
              )}
            </Button>

            <Button
              size="sm"
              onClick={handleSaveAndContinue}
              disabled={!provider || !apiKey || isSaving}
              className="h-7 text-xs"
            >
              {isSaving ? "Saving..." : "Save & Continue"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
