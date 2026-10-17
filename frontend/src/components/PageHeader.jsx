export default function PageHeader({ title, subtitle, action, testid }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 pb-5 border-b border-slate-800" data-testid={testid || "page-header"}>
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
