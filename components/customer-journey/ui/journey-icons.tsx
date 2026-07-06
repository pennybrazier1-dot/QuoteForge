import type { ReactNode } from "react";

type IconProps = {
  className?: string;
};

function BaseIcon({
  children,
  className = "cj-icon",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function BoltIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </BaseIcon>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </BaseIcon>
  );
}

export function CheckShieldIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </BaseIcon>
  );
}

export function StarIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
    </BaseIcon>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </BaseIcon>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </BaseIcon>
  );
}

export function SparkleIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" />
      <path d="M5 17l.75 2.25L8 20l-2.25.75L5 23l-.75-2.25L2 20l2.25-.75L5 17Z" />
    </BaseIcon>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </BaseIcon>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M20 6 9 17l-5-5" />
    </BaseIcon>
  );
}

export function UploadIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m17 8-5-5-5 5" />
      <path d="M12 3v12" />
    </BaseIcon>
  );
}

export function CameraIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3" />
    </BaseIcon>
  );
}

export function TradeIcon({ name, className }: { name: string; className?: string }) {
  switch (name) {
    case "zap":
      return <BoltIcon className={className} />;
    case "droplet":
      return (
        <BaseIcon className={className}>
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69Z" />
        </BaseIcon>
      );
    case "hammer":
      return (
        <BaseIcon className={className}>
          <path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12.5 9" />
          <path d="M17.64 6.36a2.83 2.83 0 0 0-4 0l-2.12 2.12 4 4 2.12-2.12a2.83 2.83 0 0 0 0-4Z" />
        </BaseIcon>
      );
    case "utensils":
      return (
        <BaseIcon className={className}>
          <path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2" />
          <path d="M7 2v20" />
          <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </BaseIcon>
      );
    case "bath":
      return (
        <BaseIcon className={className}>
          <path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-2.12 2.12L7 8" />
          <path d="M14 6l2.5-2.5a1.5 1.5 0 0 1 2.12 2.12L16 8" />
          <path d="M4 12h16" />
          <path d="M4 12v4a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-4" />
        </BaseIcon>
      );
    case "tree":
      return (
        <BaseIcon className={className}>
          <path d="M12 22v-7" />
          <path d="M9 22h6" />
          <path d="M12 15c-3-2.5-4-5-4-7a4 4 0 0 1 8 0c0 2-1 4.5-4 7Z" />
        </BaseIcon>
      );
    case "building":
      return (
        <BaseIcon className={className}>
          <rect width="16" height="20" x="4" y="2" rx="1" />
          <path d="M9 6h.01M9 10h.01M9 14h.01M15 6h.01M15 10h.01M15 14h.01" />
        </BaseIcon>
      );
    case "paint":
      return (
        <BaseIcon className={className}>
          <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" />
          <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 4-1 6-1l-7-13Z" />
        </BaseIcon>
      );
    case "home":
      return (
        <BaseIcon className={className}>
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
          <path d="M9 22V12h6v10" />
        </BaseIcon>
      );
    case "flame":
      return (
        <BaseIcon className={className}>
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />
        </BaseIcon>
      );
    case "waves":
      return (
        <BaseIcon className={className}>
          <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
          <path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
        </BaseIcon>
      );
  }

  return (
    <BaseIcon className={className}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </BaseIcon>
  );
}

export function StepIcon({ name, className }: { name: string; className?: string }) {
  switch (name) {
    case "grid":
      return (
        <BaseIcon className={className}>
          <rect width="7" height="7" x="3" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="14" rx="1" />
          <rect width="7" height="7" x="3" y="14" rx="1" />
        </BaseIcon>
      );
    case "user":
      return (
        <BaseIcon className={className}>
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </BaseIcon>
      );
    case "file":
      return (
        <BaseIcon className={className}>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        </BaseIcon>
      );
    case "camera":
      return <CameraIcon className={className} />;
    case "ruler":
      return (
        <BaseIcon className={className}>
          <path d="M21 8V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
          <path d="M7 8h2M11 8h2M15 8h2" />
        </BaseIcon>
      );
    case "help":
      return (
        <BaseIcon className={className}>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </BaseIcon>
      );
    case "check":
      return <CheckIcon className={className} />;
    default:
      return <StepIcon name="grid" className={className} />;
  }
}
