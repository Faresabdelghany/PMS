"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileSettings, AISettings, OrganizationSettings } from "@/components/settings"
import { User, Sparkles, Building2 } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account, AI configuration, and organization settings.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="w-full justify-start border-b bg-transparent p-0 h-auto">
          <TabsTrigger
            value="profile"
            className="relative -mb-px rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            <User className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            className="relative -mb-px rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            AI
          </TabsTrigger>
          <TabsTrigger
            value="organization"
            className="relative -mb-px rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            <Building2 className="mr-2 h-4 w-4" />
            Organization
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          <AISettings />
        </TabsContent>

        <TabsContent value="organization" className="mt-6">
          <OrganizationSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}
