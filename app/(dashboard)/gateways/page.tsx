import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { getPageOrganization } from "@/lib/page-auth"
import { getGateways } from "@/lib/actions/gateways"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { GatewaysListClient } from "./gateways-list-client"
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus"
import { PlugsConnected } from "@phosphor-icons/react/dist/ssr/PlugsConnected"

export const metadata: Metadata = {
  title: "Gateways - PMS",
}

export default async function GatewaysPage() {
  const { orgId } = await getPageOrganization()
  const gatewaysResult = await getGateways(orgId)
  const gateways = gatewaysResult.data || []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PlugsConnected className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Gateways</h1>
            <p className="text-sm text-muted-foreground">Manage OpenClaw gateway connections</p>
          </div>
        </div>
        <Link href="/gateways/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Gateway
          </Button>
        </Link>
      </div>

      <Suspense fallback={<PageSkeleton />}>
        <GatewaysListClient gateways={gateways} />
      </Suspense>
    </div>
  )
}
