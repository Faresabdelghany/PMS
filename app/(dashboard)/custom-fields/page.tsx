import type { Metadata } from "next"
import { getPageOrganization } from "@/lib/page-auth"
import { getCustomFieldDefs } from "@/lib/actions/custom-fields"
import { CustomFieldsClient } from "./custom-fields-client"

export const metadata: Metadata = { title: "Custom Fields - PMS" }

export default async function CustomFieldsPage() {
  const { orgId } = await getPageOrganization()
  const result = await getCustomFieldDefs(orgId)
  const fields = result.data ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Custom Fields</h1>
        <p className="text-sm text-muted-foreground">
          Define custom fields for tasks across your organization
        </p>
      </div>
      <CustomFieldsClient fields={fields} orgId={orgId} />
    </div>
  )
}
