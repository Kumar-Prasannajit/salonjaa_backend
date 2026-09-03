export interface CreateReviewInput {
  bookingId: string;
  overallRating: number;
  review?: string;
  serviceRating: number;
  staffRating: number;
  hygieneRating: number;
  ambienceRating: number;
  productRating: number;
}

export interface UpdateReviewInput {
  overallRating?: number;
  review?: string;
  serviceRating?: number;
  staffRating?: number;
  hygieneRating?: number;
  ambienceRating?: number;
  productRating?: number;
}

export interface ReplyReviewInput {
  message: string;
}

export interface ReviewDTO {
  id: string;
  bookingId: string;
  customerId: string | null;
  salonId: string;
  branchId: string;
  staffId: string | null;
  overallRating: number;
  review: string | null;
  serviceRating: number | null;
  staffRating: number | null;
  hygieneRating: number | null;
  ambienceRating: number | null;
  productRating: number | null;
  isEdited: boolean;
  createdAt: string;
  reply?: { message: string; createdAt: string } | null;
}
