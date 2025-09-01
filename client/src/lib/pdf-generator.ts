import type { ProposalForm } from "@shared/schema";
import { calculateInvestmentProjections } from "./calculations";

export async function generateProposalPDF(proposalData: ProposalForm): Promise<Blob> {
  const response = await fetch("/api/proposals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(proposalData),
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to save proposal");
  }

  const proposal = await response.json();
  
  const pdfResponse = await fetch(`/api/proposals/${proposal.id}/pdf`, {
    method: "POST",
    credentials: "include",
  });

  if (!pdfResponse.ok) {
    throw new Error("Failed to generate PDF");
  }

  return await pdfResponse.blob();
}

export function downloadPDF(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function formatCurrency(amount: number): string {
  return `R ${amount.toLocaleString()}`;
}

export function formatPercentage(percentage: number): string {
  return `${percentage.toFixed(2)}%`;
}
