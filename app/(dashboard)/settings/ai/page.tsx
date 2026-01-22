"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, Sparkles } from "lucide-react"
import {
  getAISettings,
  saveAISettings,
  saveAIApiKey,
  deleteAIApiKey,
  getMaskedApiKey,
} from "@/lib/actions/user-settings"
import { AI_MODELS, type AIProvider } from "@/lib/constants/ai"
import { testAIConnection } from "@/lib/actions/ai"

export default function AISettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [provider, setProvider] = useState<AIProvider>(null)
  const [model, setModel] = useState<string>("")
  const [apiKey, setApiKey] = useState("")
  const [maskedKey, setMaskedKey] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  // Test result
  const [testResult, setTestResult] = useState<{
    success: boolean
    model?: string
    error?: string
  } | null>(null)

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true)
      try {
        const [settingsResult, maskedResult] = await Promise.all([
          getAISettings(),
          getMaskedApiKey(),
        ])

        if (settingsResult.data) {
          setProvider(settingsResult.data.ai_provider)
          setModel(settingsResult.data.ai_model_preference || "")
        }

        if (maskedResult.data) {
          setMaskedKey(maskedResult.data)
        }
      } catch {
        setError("Failed to load settings")
      }
      setIsLoading(false)
    }

    loadSettings()
  }, [])

  // Update model when provider changes
  useEffect(() => {
    if (provider && AI_MODELS[provider]) {
      // Set default model for provider if no model selected
      if (!model || !AI_MODELS[provider].find((m) => m.value === model)) {
        setModel(AI_MODELS[provider][0].value)
      }
    } else {
      setModel("")
    }
  }, [provider])

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    setTestResult(null)

    try {
      // Save provider and model
      const settingsResult = await saveAISettings({
        ai_provider: provider,
        ai_model_preference: model,
      })

      if (settingsResult.error) {
        setError(settingsResult.error)
        setIsSaving(false)
        return
      }

      // Save API key if provided
      if (apiKey.trim()) {
        const keyResult = await saveAIApiKey(apiKey.trim())
        if (keyResult.error) {
          setError(keyResult.error)
          setIsSaving(false)
          return
        }
        // Clear the input and update masked key
        setApiKey("")
        const maskedResult = await getMaskedApiKey()
        if (maskedResult.data) {
          setMaskedKey(maskedResult.data)
        }
      }

      setSuccess("Settings saved successfully")
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError("Failed to save settings")
    }

    setIsSaving(false)
  }

  async function handleDeleteApiKey() {
    if (!confirm("Are you sure you want to delete your API key?")) return

    setIsSaving(true)
    setError(null)

    const result = await deleteAIApiKey()

    if (result.error) {
      setError(result.error)
    } else {
      setMaskedKey(null)
      setSuccess("API key deleted")
      setTimeout(() => setSuccess(null), 3000)
    }

    setIsSaving(false)
  }

  async function handleTestConnection() {
    setIsTesting(true)
    setError(null)
    setTestResult(null)

    const result = await testAIConnection()

    if (result.error) {
      setTestResult({ success: false, error: result.error })
    } else if (result.data) {
      setTestResult({ success: result.data.success, model: result.data.model })
    }

    setIsTesting(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const models = provider ? AI_MODELS[provider] || [] : []

  return (
    <div className="container max-w-2xl py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          AI Settings
        </h1>
        <p className="text-muted-foreground">
          Configure your AI provider to enable smart features like task generation and note summaries.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-500/10 p-4 text-green-600 text-sm">
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>AI Provider Configuration</CardTitle>
          <CardDescription>
            Choose your preferred AI provider and enter your API key. Your key is stored securely
            and never shared.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label htmlFor="provider">AI Provider</Label>
              <Select
                value={provider || ""}
                onValueChange={(v) => setProvider(v as AIProvider)}
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="google">Google (Gemini)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose your AI provider. Each provider requires its own API key.
              </p>
            </div>

            {/* Model Selection */}
            {provider && (
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select the model to use. Smaller models are faster and cheaper.
                </p>
              </div>
            )}

            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="apiKey"
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={maskedKey || "Enter your API key"}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {maskedKey && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteApiKey}
                    disabled={isSaving}
                  >
                    Delete
                  </Button>
                )}
              </div>
              {maskedKey && (
                <p className="text-xs text-muted-foreground">
                  Current key: {maskedKey}. Enter a new key to replace it.
                </p>
              )}
              {!maskedKey && (
                <p className="text-xs text-muted-foreground">
                  Get your API key from your provider's dashboard.
                </p>
              )}
            </div>

            {/* API Key Help Links */}
            <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
              <p className="font-medium">Where to get API keys:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    OpenAI API Keys
                  </a>
                </li>
                <li>
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Anthropic API Keys
                  </a>
                </li>
                <li>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google AI Studio API Keys
                  </a>
                </li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isSaving || !provider}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Test Connection */}
      <Card>
        <CardHeader>
          <CardTitle>Test Connection</CardTitle>
          <CardDescription>
            Verify your AI configuration is working correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleTestConnection}
            disabled={isTesting || !provider || !maskedKey}
            variant="outline"
          >
            {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test AI Connection
          </Button>

          {testResult && (
            <div
              className={`rounded-lg p-4 flex items-center gap-3 ${
                testResult.success
                  ? "bg-green-500/10 text-green-600"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {testResult.success ? (
                <>
                  <CheckCircle className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Connection successful!</p>
                    <p className="text-sm opacity-80">Model: {testResult.model}</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Connection failed</p>
                    <p className="text-sm opacity-80">{testResult.error}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {!provider && (
            <p className="text-sm text-muted-foreground">
              Select a provider and save your settings to test the connection.
            </p>
          )}
          {provider && !maskedKey && (
            <p className="text-sm text-muted-foreground">
              Enter your API key and save settings to test the connection.
            </p>
          )}
        </CardContent>
      </Card>

      {/* AI Features Info */}
      <Card>
        <CardHeader>
          <CardTitle>AI-Powered Features</CardTitle>
          <CardDescription>
            Once configured, you'll have access to these AI features:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Generate Project Descriptions</p>
                <p className="text-sm text-muted-foreground">
                  Create professional project descriptions from basic information.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Smart Task Generation</p>
                <p className="text-sm text-muted-foreground">
                  Automatically generate relevant tasks for your projects.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Note Summarization</p>
                <p className="text-sm text-muted-foreground">
                  Get AI summaries of your meeting notes and project updates.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Voice Transcription Enhancement</p>
                <p className="text-sm text-muted-foreground">
                  Clean up and format voice transcriptions into structured notes.
                </p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
