/**
 * Shared state shape for the view-basic demo.
 */

export interface Invoice {
  id: string;
  number: string;
  customer: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "overdue";
  issuedAt: string;
}

export interface AppState {
  invoices: Invoice[];
}
