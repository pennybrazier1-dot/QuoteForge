import {
  CustomerVisitConfirmation,
  CustomerVisitConfirmationMissing,
} from "@/components/visits/customer-visit-confirmation";
import { loadPublicVisitByToken } from "@/lib/visits/customer-confirmation/load-public-visit";

export default async function PublicVisitConfirmationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const loaded = await loadPublicVisitByToken(token);

  if (!loaded.ok) {
    return <CustomerVisitConfirmationMissing message={loaded.error} />;
  }

  return <CustomerVisitConfirmation view={loaded.view} />;
}
