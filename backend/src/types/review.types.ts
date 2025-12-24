export interface CreateReviewData {
  tripId: string;
  rating: number; // 1-5
  comment?: string;
}

export interface ReviewStats {
  total: number;
  average: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

