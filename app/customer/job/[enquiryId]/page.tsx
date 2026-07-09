import { CustomerJobView } from "@/components/customer/customer-job-view";

export default async function CustomerJobPage({
  params,
}: {
  params: Promise<{ enquiryId: string }>;
}) {
  const { enquiryId } = await params;

  return <CustomerJobView enquiryId={enquiryId} />;
}
