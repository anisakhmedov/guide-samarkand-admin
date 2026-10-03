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
export type DiscountStatus = 'none' | 'pending' | 'approved';

export interface GuestHistoryEntry {
  action: string;
  byAdminName?: string;
  at: string;
}

export type ContactChannel = 'telegram' | 'whatsapp' | 'instagram' | 'wechat' | 'viber' | 'other';

export interface GuestContact {
  type: ContactChannel;
  value: string;
}

export interface Guest {
  _id: string;
  name: string;
  roomNumber: string;
  phone?: string;
  contacts?: GuestContact[];
  statusResidence: ResidenceStatus;
  statusReview: ReviewStatus;
  accessStatus: AccessStatus;
  discountStatus: DiscountStatus;
  /** Omitted by the list endpoint — present on GET /admin/guests/:id and PATCH responses. */
  history?: GuestHistoryEntry[];
  /** Registration step 2: ISO country code + YYYY-MM-DD. */
  country?: string;
  birthDate?: string;
  /** Registration step 3: house rules signed. The PNG signature only comes with GET /admin/guests/:id. */
  rulesAcceptedAt?: string | null;
  rulesSignature?: string;
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

export type MenuItemType = 'food' | 'drink';

export interface MenuItem {
  _id: string;
  type: MenuItemType;
  name: string;
  description: string;
  price: number;
  discountedPrice: number;
  photo: string;
  active: boolean;
}

export type ServiceRequestType = 'food_order' | 'drink_order' | 'wake_up' | 'cleaning' | 'problem' | 'extension' | 'hookah';
export type ServiceRequestStatus = 'new' | 'in_progress' | 'done' | 'rejected';

export interface ServiceRequest {
  _id: string;
  guestId: { _id: string; name: string; roomNumber: string; phone?: string } | string | null;
  type: ServiceRequestType;
  status: ServiceRequestStatus;
  payload: Record<string, any>;
  total: number;
  paid: boolean;
  paidAt: string | null;
  adminComment: string;
  createdAt: string;
  updatedAt: string;
}

export interface HotelSettings {
  discountPercent: number;
  markupPercent: number;
  hookahPrice: number;
  hookahAvailable: boolean;
}

export interface AdminNotifications {
  unreadChat: number;
  newRequests: number;
  pendingGuests: number;
  pendingReviews: number;
  pendingDiscounts: number;
  lastGuestActivityAt: string | null;
}
