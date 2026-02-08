"use client"

import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle"
import { PlaceholderPane, SettingsPaneHeader } from "../setting-primitives"

export function SkillsPane() {
  return (
    <div className="space-y-8">
      <SettingsPaneHeader
        title="Skills"
        description="Configure AI skills to automate specific workflows and enhance your productivity."
      />

      <PlaceholderPane
        icon={<Sparkle className="h-12 w-12" />}
        title="AI Skills"
        description="Configure specialized AI capabilities for your workspace. Customize skills for task automation, content generation, and workflow optimization. This feature is coming soon."
      />
    </div>
  )
}
