import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { getPageOrganization } from "@/lib/page-auth"
import { getGateways } from "@/lib/actions/gateways"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { GatewaysListClient } from "./gateways-list-client"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"

export const metadata: Metadata = {
  title: "Gateways - PMS",
}

export default async function GatewaysPage() {
  const { orgId } = await getPageOrganization()
  const gatewaysResult = await getGateways(orgId)
  const gateways = gatewaysResult.data || []

  return (
    <div className="flex flex-1 flex-col bg-background mx-2 my-2 border border-border rounded-lg min-w-0">
      <PageHeader
        title="Gateways"
        actions={
          <Link href="/gateways/new">
            <Button variant="ghost" size="sm">
              <Plus className="h-4 w-4" weight="bold" />
              New Gateway
            </Button>
          </Link>
        }
      />
      <div className="p-6 flex flex-col gap-6">
        <Suspense fallback={<PageSkeleton />}>
          <GatewaysListClient gateways={gateways} />
        </Suspense>
      </div>
    </div>
  )
}
