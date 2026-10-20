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
  const [initialBudget, setBudget] = useState("10000");
  const [ticketValue, setTicket] = useState("350");
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
            exec(() => createProjectAction({ agencyId, name, segment, launchDate, initialBudget: Number(initialBudget), ticketValue: Number(ticketValue) }), {
              success: "Projeto criado.",
              onOk: (r) => r.ok && r.data && router.push(`/p/${(r.data as { id: string }).id}`),
            });
          }}
        >
          <Field label="Marca / cliente"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Segmento"><input className="input" value={segment} onChange={(e) => setSegment(e.target.value)} /></Field>
          <Field label="Data de lançamento (opcional)"><input className="input" type="date" value={launchDate} onChange={(e) => setLaunch(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Verba inicial (R$)"><input className="input" type="number" min={1} value={initialBudget} onChange={(e) => setBudget(e.target.value)} /></Field>
            <Field label="Ticket médio (R$)"><input className="input" type="number" min={1} value={ticketValue} onChange={(e) => setTicket(e.target.value)} /></Field>
          </div>
          <p className="text-xs text-carvao/60">Tudo pode ser alterado depois em Configurações.</p>
          <div className="flex justify-end"><button className="btn-primary" disabled={pending}>Criar</button></div>
        </form>
      </Modal>
    </>
  );
}
