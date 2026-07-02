import { getPreviewBuildInfo } from "@/lib/env/preview-build";

export function PreviewBuildBadge() {
  const info = getPreviewBuildInfo();

  if (!info) {
    return null;
  }

  return (
    <div className="qf-preview-build-badge" aria-hidden="true">
      <span className="qf-preview-build-badge-title">Preview Build</span>
      <span className="qf-preview-build-badge-commit">
        Commit: {info.commitSha}
      </span>
    </div>
  );
}
