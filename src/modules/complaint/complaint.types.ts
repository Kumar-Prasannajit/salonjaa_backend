export interface FileComplaintInput {
  type: "BOOKING" | "PAYMENT" | "SALON" | "STAFF" | "REFUND" | "OTHER";
  referenceId?: string;
  description: string;
}

export interface ComplaintDTO {
  id: string;
  filedByUserId: string;
  type: string;
  referenceId: string | null;
  description: string;
  status: string;
  createdAt: string;
}
