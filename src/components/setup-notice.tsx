export default function SetupNotice({ error }: { error: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
      <h2 className="font-semibold text-amber-900 mb-1">Can&apos;t load data yet</h2>
      <p className="text-sm text-amber-800 mb-2">
        This usually means Supabase (or another integration) isn&apos;t configured yet. Fill in{" "}
        <code className="bg-amber-100 px-1 py-0.5 rounded">.env.local</code> per{" "}
        <code className="bg-amber-100 px-1 py-0.5 rounded">.env.example</code> and run the schema in{" "}
        <code className="bg-amber-100 px-1 py-0.5 rounded">supabase/migrations/</code>.
      </p>
      <pre className="text-xs bg-amber-100 text-amber-900 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
        {error}
      </pre>
    </div>
  );
}
