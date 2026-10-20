import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-3xl">Página não encontrada</h1>
      <p className="muted mt-2">O conteúdo não existe ou você não tem acesso a ele.</p>
      <Link href="/projetos" className="btn-primary mt-6">Voltar aos projetos</Link>
    </main>
  );
}
