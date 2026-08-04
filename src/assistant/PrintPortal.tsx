import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Logo } from '../components/Logo';
import { triggerPrint } from '../lib/print';
import type { AssistantReport } from './types';
import { ReportBlocks } from './ReportBlocks';

/**
 * Renders a report into a light-themed, print-only region attached to
 * <body> (via a portal, so it escapes the panel's transformed subtree) and
 * triggers the browser/Electron print dialog. Export-to-PDF is then just
 * "Save as PDF" in that dialog — no PDF library needed at this stage.
 */
export function PrintPortal({
  report,
  onDone,
}: {
  report: AssistantReport;
  onDone: () => void;
}) {
  useEffect(() => triggerPrint(onDone), [onDone]);

  const generated = new Date(report.generatedAt).toLocaleString('fr-FR');

  return createPortal(
    <div className="print-root">
      <div className="mb-8 flex items-center justify-between border-b border-neutral-200 pb-5">
        <Logo height={30} showTagline showAppName />
        <div className="text-right text-xs text-neutral-500">
          <p className="font-medium text-neutral-700">Rapport de supervision</p>
          <p>Généré le {generated}</p>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-neutral-900">{report.title}</h1>
      <p className="mb-6 mt-1 text-sm text-neutral-500">{report.subtitle}</p>

      <ReportBlocks blocks={report.blocks} variant="print" />

      <p className="mt-10 border-t border-neutral-200 pt-4 text-xs text-neutral-400">
        Document généré par l’assistant AMN Desktop · confidentiel
      </p>
    </div>,
    document.body,
  );
}
