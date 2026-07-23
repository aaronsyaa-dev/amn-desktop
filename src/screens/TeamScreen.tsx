import React from 'react';

export function TeamScreen() {
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text-primary">Équipe</h1>
      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-sm text-text-secondary">Chargement…</p>
      </div>
    </section>
  );
}
