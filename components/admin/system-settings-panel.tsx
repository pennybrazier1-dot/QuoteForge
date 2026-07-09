import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSection } from "@/components/admin/admin-section";
import { isDevTestingEnabled } from "@/lib/env/dev-testing";

export function SystemSettingsPanel() {
  const devToolsEnabled = isDevTestingEnabled();
  const vercelEnv = process.env.VERCEL_ENV ?? "local";
  const nodeEnv = process.env.NODE_ENV ?? "unknown";

  return (
    <div className="qf-admin-page">
      <AdminPageHeader
        title="System Settings"
        description="Platform configuration placeholders during development."
      />

      <div className="qf-admin-settings-grid">
        <AdminSection
          title="Feature flags"
          description="Toggle features on or off — placeholder only."
        >
          <ul className="qf-admin-flag-list">
            <li className="qf-admin-flag-item">
              <span>Customer enquiry journey</span>
              <span className="qf-admin-pill qf-admin-pill-yes">On</span>
            </li>
            <li className="qf-admin-flag-item">
              <span>AI proposal generation</span>
              <span className="qf-admin-pill qf-admin-pill-yes">On</span>
            </li>
            <li className="qf-admin-flag-item">
              <span>Email sending (Resend)</span>
              <span className="qf-admin-pill qf-admin-pill-yes">On</span>
            </li>
            <li className="qf-admin-flag-item">
              <span>Stripe billing</span>
              <span className="qf-admin-pill qf-admin-pill-no">Off</span>
            </li>
          </ul>
        </AdminSection>

        <AdminSection
          title="Dev tools"
          description="Testing helpers available in local and preview builds."
        >
          <p className="qf-admin-settings-value">
            Dev testing:{" "}
            <span className="qf-admin-pill qf-admin-pill-yes">
              {devToolsEnabled ? "Enabled" : "Disabled"}
            </span>
          </p>
          <p className="qf-admin-settings-copy">
            Includes journey preview switcher, simulated proposal send, and
            lifecycle test tools in the trader app.
          </p>
        </AdminSection>

        <AdminSection title="Environment">
          <dl className="qf-admin-env-list">
            <div>
              <dt>VERCEL_ENV</dt>
              <dd>
                <code className="qf-admin-code">{vercelEnv}</code>
              </dd>
            </div>
            <div>
              <dt>NODE_ENV</dt>
              <dd>
                <code className="qf-admin-code">{nodeEnv}</code>
              </dd>
            </div>
          </dl>
        </AdminSection>

        <AdminSection
          title="Admin access"
          description="Temporary allowlist until role-based auth is added."
        >
          <p className="qf-admin-settings-copy">
            Platform admin access is granted when a signed-in user&apos;s email
            appears in the{" "}
            <code className="qf-admin-code">PLATFORM_ADMIN_EMAILS</code>{" "}
            environment variable. Other users cannot see the Admin sidebar link
            or open <code className="qf-admin-code">/admin</code> routes.
          </p>
        </AdminSection>
      </div>
    </div>
  );
}
