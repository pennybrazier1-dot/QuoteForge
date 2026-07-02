import { getGreetingName, getTimeGreeting } from "@/lib/home/home-data";

export function HomeGreeting({
  fullName,
  notificationCount,
}: {
  fullName: string | null;
  notificationCount: number;
}) {
  const greeting = getTimeGreeting();
  const name = getGreetingName(fullName);

  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <header className="qf-home-header">
      <div className="qf-home-header-top">
        <div className="qf-home-header-copy">
          <h1 className="qf-home-greeting-title">
            {greeting},{" "}
            <span className="qf-home-greeting-name">{name}</span>
          </h1>
          <p className="qf-home-greeting-date">{today}</p>
        </div>

        <button
          type="button"
          className="qf-home-notifications qf-touch-target"
          aria-label={
            notificationCount > 0
              ? `${notificationCount} notifications`
              : "Notifications"
          }
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {notificationCount > 0 ? (
            <span className="qf-home-notifications-badge" aria-hidden="true">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          ) : null}
        </button>
      </div>

      <h2 className="qf-home-question">
        What do you need to get done today?
      </h2>
    </header>
  );
}
