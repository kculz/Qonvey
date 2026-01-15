// backend/src/types/review.types.ts

export interface CreateReviewData {
  tripId: string;
  rating: number;
  comment?: string;
}

export interface ReviewResponse {
  id: string;
  tripId: string;
  authorId: string;
  receiverId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
  author?: any;
  receiver?: any;
  trip?: any;
}

export interface ReviewPagination {
  reviews: ReviewResponse[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface RatingBreakdown {
  totalReviews: number;
  averageRating: number;
  breakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export interface PendingReview {
  tripId: string;
  loadTitle: string;
  completedAt: Date;
  reviewFor: {
    id: string;
    name: string;
    companyName?: string;
    role: 'Driver' | 'Cargo Owner';
  };
}

export interface UserReviewStats extends RatingBreakdown {
  reviewsReceived: number;
  reviewsGiven: number;
  responseRate: number;
}

export interface MonthlyReviewStats {
  month: Date;
  review_count: number;
  average_rating: number;
}

export interface ReviewSummary {
  reviewsReceived: {
    total: number;
    average: number;
    recent: ReviewResponse[];
    breakdown: RatingBreakdown['breakdown'];
  };
  reviewsGiven: {
    total: number;
    recent: ReviewResponse[];
  };
}

export interface ReviewSearchFilters {
  userId?: string;
  minRating?: number;
  maxRating?: number;
  startDate?: Date;
  endDate?: Date;
  hasComment?: boolean;
}

export interface ReviewValidationResult {
  allowed: boolean;
  reason?: string;
}

export interface TopRatedUser {
  id: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  profileImage?: string;
  rating: number;
  totalRatings: number;
  role: string;
}