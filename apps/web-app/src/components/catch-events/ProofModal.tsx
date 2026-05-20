import React from 'react';
import { smallButtonClasses, type ScreenshotProof } from './shared';

type Props = {
  proof: ScreenshotProof | null;
  tr: (text: string) => string;
  onClose: () => void;
};

export function ProofModal({ proof, tr, onClose }: Props) {
  if (!proof) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={proof.name || proof.fileName || tr('Screenshot proof')}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-5xl rounded-lg bg-white p-4 shadow-2xl dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {proof.name || proof.fileName || tr('Screenshot proof')}
          </p>
          <button
            type="button"
            className={smallButtonClasses}
            onClick={onClose}
          >
            {tr('Close')}
          </button>
        </div>
        <img
          className="max-h-[78vh] w-full rounded-lg object-contain"
          src={proof.dataUrl || proof.url}
          alt={proof.name || proof.fileName || tr('Screenshot proof')}
        />
      </div>
    </div>
  );
}
