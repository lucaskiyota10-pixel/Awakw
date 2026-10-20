export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-areia/40 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-taupe">Plataforma de campanhas</p>
          <h1 className="text-4xl">Campaign Forge</h1>
          <p className="muted mt-1 text-sm">Planejamento, simulação e documentação acadêmica</p>
        </div>
        <div className="card bg-white p-7">{children}</div>
      </div>
    </main>
  );
}
