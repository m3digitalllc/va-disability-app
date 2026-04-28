"use client";
import { Info } from "lucide-react";
import { useState } from "react";

export function FieldTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-flex items-center ml-1.5 align-middle">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        aria-label="Field help"
        className="focus:outline-none focus:ring-2 focus:ring-brand-400 rounded-full"
      >
        <Info className="w-3.5 h-3.5 text-gray-400 hover:text-brand-500 cursor-help transition-colors" />
      </button>

      {show && (
        <span
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2.5 w-72 px-3 py-2.5 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50 leading-relaxed whitespace-normal pointer-events-none"
        >
          {text}
          <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}
