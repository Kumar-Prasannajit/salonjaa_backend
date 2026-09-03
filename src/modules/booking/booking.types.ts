export interface CreateBookingInput {
  salonId: string;
  branchId: string;
  services: string[]; // service IDs; duplicates mean quantity > 1 for that service
  staffId?: string;
  bookingDate: string; // YYYY-MM-DD
  slotId: string; // "HH:MM-HH:MM"
  notes?: string;
}

export interface CancelBookingInput {
  reason?: string;
}

export interface RescheduleRequestInput {
  bookingDate: string;
  slotId: string;
  reason?: string;
}

export interface RejectRescheduleInput {
  reason?: string;
}

export interface ApproveBookingInput {
  notes?: string;
}

export interface RejectBookingInput {
  reason: string;
}

export interface ProposeRescheduleInput {
  bookingDate: string;
  slotId: string;
  reason?: string;
}

export interface WalkInInput {
  customerName: string;
  customerPhone: string;
  services: string[];
  staffId: string;
  bookingDate: string;
  slotId: string;
}

export interface BookingServiceLine {
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  price: number;
  quantity: number;
  totalAmount: number;
}

export interface BookingDTO {
  id: string;
  bookingNumber: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  salonId: string;
  branchId: string;
  bookingType: string;
  bookingStatus: string;
  selectedStaffId: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  totalDurationMinutes: number;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  services?: BookingServiceLine[];
}

export interface RescheduleRequestDTO {
  id: string;
  bookingId: string;
  requestedBy: string;
  oldScheduledStart: string;
  oldScheduledEnd: string;
  newScheduledStart: string;
  newScheduledEnd: string;
  reason: string | null;
  status: string;
}
