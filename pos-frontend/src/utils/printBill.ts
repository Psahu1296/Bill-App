import React from "react";
import { createRoot } from "react-dom/client";
import BillTemplate from "../components/invoice/BillTemplate";
import type { Order } from "../types";

export function printBill(order: Order): void {
  let container = document.getElementById("bill-print-root");
  if (!container) {
    container = document.createElement("div");
    container.id = "bill-print-root";
    container.style.display = "none"; // hidden in normal view; @media print overrides this
    document.body.appendChild(container);
  }

  const root = createRoot(container);
  root.render(React.createElement(BillTemplate, { order }));

  // Give React one frame to flush, then open the native print dialog
  requestAnimationFrame(() => {
    window.print();
    window.addEventListener("afterprint", () => {
      root.unmount();
      container?.remove(); // remove from DOM entirely after printing
    }, { once: true });
  });
}
