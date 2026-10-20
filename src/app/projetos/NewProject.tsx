"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Modal, useAction } from "@/components/ui";
import { createProjectAction } from "../actions/project";

export function NewProject({ agencyId }: { agencyId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [launchDate, setLaunch] = useState("");
  const { exec, pending } = useAction();
  const router = useRouter();
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>Novo projeto</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo projeto">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(() => createProjectAction({ agencyId, name, segment, launchDate }), {
              success: "Projeto criado.",
              onOk: (r) => r.ok && r.data && router.push(`/p/${(r.data as { id: string }).id}`),
            });
          }}
        >
          <Field label="Nome do cliente/projeto"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Segmento"><input className="input" value={segment} onChange={(e) => setSegment(e.target.value)} /></Field>
          <Field label="Data de lançamento (opcional)"><input className="input" type="date" value={launchDate} onChange={(e) => setLaunch(e.target.value)} /></Field>
          <div className="flex justify-end"><button className="btn-primary" disabled={pending}>Criar</button></div>
        </form>
      </Modal>
    </>
  );
}
