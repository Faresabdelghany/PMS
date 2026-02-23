import type { Metadata } from "next"
import { getPageOrganization } from "@/lib/page-auth"
import { getSkills, seedDefaultSkills } from "@/lib/actions/skills"
import { SkillsMarketplaceClient } from "./marketplace-client"

export const metadata: Metadata = {
  title: "Skills Marketplace - PMS",
}

export default async function SkillsMarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { orgId } = await getPageOrganization()
  const { category } = await searchParams

  // Fetch skills from DB; seed defaults if this org has none yet
  let skillsResult = await getSkills(orgId)
  if (!skillsResult.error && (skillsResult.data?.length ?? 0) === 0) {
    await seedDefaultSkills(orgId)
    skillsResult = await getSkills(orgId)
  }

  const skills = skillsResult.data ?? []

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <SkillsMarketplaceClient initialSkills={skills} initialCategory={category} />
    </div>
  )
}
