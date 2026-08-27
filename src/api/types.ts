export type PlaceCategory = 'restaurant' | 'cafe' | 'attraction' | 'service';

export interface Place {
  _id: string;
  category: PlaceCategory;
  name: string;
  description: string;
  photos: string[];
  location: { lat: number; lng: number };
  district: string;
  workingHours: string;
  extraFields: Record<string, unknown>;
  recommendedByHotel: boolean;
  active: boolean;
}

export type ResidenceStatus = 'pending' | 'approved' | 'rejected';
export type ReviewStatus = 'not_sent' | 'pending' | 'approved';
export type AccessStatus = 'open' | 'closed';

export interface GuestHistoryEntry {
  action: string;
  byAdminName?: string;
  at: string;
}

export interface Guest {
  _id: string;
  name: string;
  roomNumber: string;
  statusResidence: ResidenceStatus;
  statusReview: ReviewStatus;
  accessStatus: AccessStatus;
  history: GuestHistoryEntry[];
  createdAt: string;
}

export type RouteTheme = 'history' | 'food' | 'kids' | 'evening' | 'photo';
export type RouteDuration = 'short' | 'half_day' | 'full_day';
export type TransportType = 'walking' | 'transport';

export interface RoutePoint {
  placeId: Place | string;
  order: number;
  comment: string;
  legDistanceMeters: number;
  legDurationMinutes: number;
}

export interface GuideRoute {
  _id: string;
  title: string;
  theme?: RouteTheme;
  durationEstimate: RouteDuration;
  transportType: TransportType;
  points: RoutePoint[];
  totalDistanceMeters: number;
  totalDurationMinutes: number;
  createdBy: 'admin' | 'guest';
  published: boolean;
}

export type ChatSender = 'guest' | 'admin';

export interface ChatMessage {
  _id: string;
  guestId: string;
  sender: ChatSender;
  text: string;
  photo?: string;
  readStatus: boolean;
  timestamp: string;
}

export interface Conversation {
  guestId: string;
  guestName: string;
  guestRoom: string;
  lastMessage: string;
  lastSender: ChatSender;
  lastTimestamp: string;
  unreadFromGuest: number;
}

export interface Feedback {
  _id: string;
  guestId?: { name: string; roomNumber: string } | string;
  text: string;
  createdAt: string;
}

export type AdminRole = 'super_admin' | 'reception' | 'content_manager';

export interface StaffMember {
  _id: string;
  name: string;
  login: string;
  role: AdminRole;
  active: boolean;
}
