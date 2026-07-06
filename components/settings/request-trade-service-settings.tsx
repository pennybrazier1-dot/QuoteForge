"use client";

import { useState } from "react";
import { SettingsSection } from "@/components/settings/settings-section";

export function RequestTradeServiceForm() {
  const [serviceName, setServiceName] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!serviceName.trim()) {
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="qf-settings-confirmation" role="status">
        Thanks — we&apos;ll review this and let you know when it&apos;s available.
      </p>
    );
  }

  return (
    <form className="qf-settings-request-form" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="request-service-name" className="block text-sm font-medium">
          Service/trade name
        </label>
        <input
          id="request-service-name"
          type="text"
          value={serviceName}
          onChange={(event) => setServiceName(event.target.value)}
          placeholder="e.g. Plastering"
          className="form-input mt-2"
          required
        />
      </div>

      <div>
        <label
          htmlFor="request-service-description"
          className="block text-sm font-medium"
        >
          Short description
        </label>
        <textarea
          id="request-service-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What type of jobs does this cover?"
          className="form-textarea mt-2"
          rows={3}
        />
      </div>

      <div>
        <label htmlFor="request-service-reason" className="block text-sm font-medium">
          Why you need it
        </label>
        <textarea
          id="request-service-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="How would this help your business?"
          className="form-textarea mt-2"
          rows={3}
        />
      </div>

      <button type="submit" className="qf-btn-primary qf-settings-request-submit">
        Send request
      </button>
    </form>
  );
}

/** Standalone section — prefer MyServicesSettings for the main settings page. */
export function RequestTradeServiceSettings() {
  return (
    <SettingsSection
      title="Request a trade or service"
      description="Missing a trade or service you offer? Tell us what you need and we will review it."
    >
      <RequestTradeServiceForm />
    </SettingsSection>
  );
}
