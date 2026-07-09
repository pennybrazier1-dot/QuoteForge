export function AdminPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="qf-admin-page-header">
      <h1 className="qf-admin-page-title">{title}</h1>
      {description ? (
        <p className="qf-admin-page-description">{description}</p>
      ) : null}
    </header>
  );
}
