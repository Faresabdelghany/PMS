import type { Metadata } from "next"
import { getPageOrganization } from "@/lib/page-auth"
import { getMarketplaceSkills } from "@/lib/actions/skills"
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

  const marketplaceResult = await getMarketplaceSkills(orgId)
  const skills = marketplaceResult.data?.skills ?? []
  const degraded = marketplaceResult.data?.degraded ?? false

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <SkillsMarketplaceClient initialSkills={skills} initialCategory={category} degraded={degraded} />
    </div>
  )
}
