import type { SupportedPlatformTrade } from "@/lib/admin/types";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSection } from "@/components/admin/admin-section";

export function SupportedTradesPanel({
  trades,
}: {
  trades: SupportedPlatformTrade[];
}) {
  return (
    <div className="qf-admin-page">
      <AdminPageHeader
        title="Supported Trades"
        description="Trades and services the platform supports for customer enquiries."
      />

      <AdminSection title="Platform catalogue">
      <div className="qf-admin-table-wrap">
        <table className="qf-admin-table">
          <thead>
            <tr>
              <th scope="col">Service / trade</th>
              <th scope="col">Question template</th>
              <th scope="col">Template key</th>
              <th scope="col">Questions</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr key={trade.id}>
                <td>{trade.label}</td>
                <td>
                  <span
                    className={
                      trade.hasQuestionTemplate
                        ? "qf-admin-pill qf-admin-pill-yes"
                        : "qf-admin-pill qf-admin-pill-no"
                    }
                  >
                    {trade.hasQuestionTemplate ? "Yes" : "No"}
                  </span>
                </td>
                <td>
                  <code className="qf-admin-code">{trade.templateTradeType}</code>
                </td>
                <td>{trade.questionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </AdminSection>
    </div>
  );
}
