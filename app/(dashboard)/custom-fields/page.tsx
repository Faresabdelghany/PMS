import type { Metadata } from "next"
import { getPageOrganization } from "@/lib/page-auth"
import { getCustomFieldDefs } from "@/lib/actions/custom-fields"
import { CustomFieldsClient } from "./custom-fields-client"
import { PageHeader } from "@/components/ui/page-header"

export const metadata: Metadata = { title: "Custom Fields - PMS" }

export default async function CustomFieldsPage() {
  const { orgId } = await getPageOrganization()
  const result = await getCustomFieldDefs(orgId)
  const fields = result.data ?? []

  return (
    <div className="flex flex-col flex-1">
      <PageHeader title="Custom Fields" />
      <div className="p-6 flex flex-col gap-6">
        <CustomFieldsClient fields={fields} orgId={orgId} />
      </div>
    </div>
  )
}
