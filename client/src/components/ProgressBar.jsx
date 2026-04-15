export function ProgressBar({ value }) {
  const width = `${Math.round((value || 0) * 100)}%`;
  return (
    <div className="h-4 w-full rounded-full bg-slate-700">
      <div
        className="h-4 rounded-full bg-cyan-400 transition-all duration-500"
        style={{ width }}
      />
    </div>
  );
}
