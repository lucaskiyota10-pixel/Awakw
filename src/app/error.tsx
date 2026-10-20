"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-3xl">Algo deu errado</h1>
      <p className="muted mt-2">Não foi possível carregar esta tela. Seus dados salvos não foram afetados.</p>
      <button onClick={reset} className="btn-primary mt-6">Tentar novamente</button>
    </main>
  );
}
