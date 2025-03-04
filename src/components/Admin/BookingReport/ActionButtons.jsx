// File: src/components/BookingsReport/ActionButtons.js
import React from "react";
import { Download, RefreshCw, Trash2, Calendar } from "lucide-react";

const ActionButtons = ({
  onExport,
  onFetchAndSync,
  onDeduplicate,
  isExportDisabled,
  isDeduplicating,
}) => {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button
        onClick={onExport}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-[#678D73] text-white rounded-lg hover:bg-[#4a6553] transition-colors w-full sm:w-auto"
        disabled={isExportDisabled}
      >
        <Download size={20} />
        Exporter
      </button>
      <button
        onClick={onFetchAndSync}
        className="flex items-center justify-center w-full gap-2 px-4 py-2 text-white transition-colors bg-blue-500 rounded-lg hover:bg-blue-600 sm:w-auto"
      >
        <RefreshCw size={20} />
        Sync Réservations
      </button>
      <button
        onClick={onDeduplicate}
        className="flex items-center justify-center w-full gap-2 px-4 py-2 text-white transition-colors bg-purple-500 rounded-lg hover:bg-purple-600 sm:w-auto"
        disabled={isDeduplicating}
      >
        <Trash2 size={20} className={isDeduplicating ? "animate-pulse" : ""} />
        Supprimer Doublons
      </button>
    </div>
  );
};

export default ActionButtons;
