"use client";

import { useState } from "react";
import { RequestTradeServiceForm } from "@/components/settings/request-trade-service-settings";
import { SettingsSection } from "@/components/settings/settings-section";

type MyServicesSettingsProps = {
  initialServices: string[];
};

export function MyServicesSettings({ initialServices }: MyServicesSettingsProps) {
  const [services, setServices] = useState(initialServices);
  const [newService, setNewService] = useState("");

  function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const label = newService.trim();
    if (!label) {
      return;
    }

    const alreadyListed = services.some(
      (service) => service.toLowerCase() === label.toLowerCase()
    );
    if (alreadyListed) {
      return;
    }

    setServices((current) => [...current, label]);
    setNewService("");
  }

  function handleRemove(service: string) {
    setServices((current) => current.filter((item) => item !== service));
  }

  return (
    <SettingsSection
      title="My Services"
      description="Services customers see when they request a quote. They pick the closest match and describe the work later."
    >
      <div className="qf-settings-services">
        {services.length === 0 ? (
          <p className="qf-settings-services-empty">
            No services yet. Add your first one below.
          </p>
        ) : (
          <ul className="qf-settings-services-list" aria-label="Current services">
            {services.map((service) => (
              <li key={service} className="qf-settings-service-item">
                <span className="qf-settings-service-label">{service}</span>
                <button
                  type="button"
                  className="qf-settings-service-remove"
                  onClick={() => handleRemove(service)}
                  aria-label={`Remove ${service}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="qf-settings-services-add" onSubmit={handleAdd}>
          <label htmlFor="add-service-name" className="block text-sm font-medium">
            Add a custom service
          </label>
          <div className="qf-settings-services-add-row">
            <input
              id="add-service-name"
              type="text"
              value={newService}
              onChange={(event) => setNewService(event.target.value)}
              placeholder="e.g. Boiler servicing"
              className="form-input"
            />
            <button type="submit" className="qf-btn-secondary qf-settings-services-add-btn">
              Add
            </button>
          </div>
          <p className="qf-settings-services-local-note">
            Changes are saved on this device only for now — not yet linked to customer
            enquiries.
          </p>
        </form>

        <div className="qf-settings-services-secondary">
          <h3 className="qf-settings-services-secondary-title">
            Request a trade or service we don&apos;t support yet
          </h3>
          <p className="qf-settings-services-secondary-copy">
            Missing something from QuoteForge&apos;s list? Tell us what you need and we
            will review it.
          </p>
          <RequestTradeServiceForm />
        </div>
      </div>
    </SettingsSection>
  );
}
