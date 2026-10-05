export interface Service {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  longDescription?: string;
  icon?: string;
  isActive: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface ServiceRequest {
  id: string;
  requestId: string;
  customerId: string;
  serviceId: string;
  status: string;
  message?: string;
  createdAt: string;
  customer?: Customer;
  service?: Service;
  [key: string]: any;
}

export interface Appointment {
  id: string;
  date: string;
  time: string;
  status: string;
  message?: string;
  customer?: Customer;
  service?: Service;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  videoId?: string;
  thumbnailUrl?: string;
  isPublished: boolean;
  publishedAt: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  category: string;
  isPublished: boolean;
  publishedAt: string;
  imageUrl?: string;
  author?: string;
  createdAt?: string;
}

export interface Testimonial {
  id: string;
  name: string;
  location?: string;
  rating: number;
  content: string;
  service?: string;
}

export interface Document {
  id: string;
  name: string;
  url: string;
  customerId?: string;
  serviceRequestId?: string;
  createdAt: string;
}
