"use client"

import { useState } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileSettings, AISettings, OrganizationSettings } from "@/components/settings"
import { User, Sparkles, Building2 } from "lucide-react"

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile")

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground" />
          <p className="text-base font-medium text-foreground">Settings</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <div className="px-4 pt-4 pb-2">
            <TabsList className="inline-flex bg-muted rounded-full px-1 py-0.5 text-xs border border-border/50 h-8">
              <TabsTrigger
                value="profile"
                className="h-7 px-3 rounded-full text-xs data-[state=active]:bg-background data-[state=active]:text-foreground gap-1.5"
              >
                <User className="h-3.5 w-3.5" />
                Profile
              </TabsTrigger>
              <TabsTrigger
                value="ai"
                className="h-7 px-3 rounded-full text-xs data-[state=active]:bg-background data-[state=active]:text-foreground gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI
              </TabsTrigger>
              <TabsTrigger
                value="organization"
                className="h-7 px-3 rounded-full text-xs data-[state=active]:bg-background data-[state=active]:text-foreground gap-1.5"
              >
                <Building2 className="h-3.5 w-3.5" />
                Organization
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto px-4 pb-4">
            <div className="max-w-2xl">
              <TabsContent value="profile" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <ProfileSettings />
              </TabsContent>

              <TabsContent value="ai" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <AISettings />
              </TabsContent>

              <TabsContent value="organization" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
                <OrganizationSettings />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
