export interface ZendeskCredentials {
  subdomain: string;
  email: string;
  apiToken: string;
}

export interface ZendeskTicket {
  id: number;
  subject: string;
  description: string;
  status: 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed';
  priority: 'urgent' | 'high' | 'normal' | 'low' | null;
  assignee_id: number | null;
  requester_id: number | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  custom_fields: Array<{ id: number; value: string | null }>;
}

export interface ZendeskComment {
  id: number;
  type: 'Comment';
  body: string;
  html_body: string;
  author_id: number;
  created_at: string;
  public: boolean;
  attachments: ZendeskAttachment[];
}

export interface ZendeskAttachment {
  id: number;
  file_name: string;
  content_url: string;
  content_type: string;
  size: number;
}

export interface ZendeskUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface ZendeskSearchResponse {
  results: ZendeskTicket[];
  count: number;
  next_page: string | null;
}

export interface ZendeskCommentsResponse {
  comments: ZendeskComment[];
  next_page: string | null;
}

export type TicketUpdatePayload = {
  ticket: {
    status?: ZendeskTicket['status'];
    priority?: ZendeskTicket['priority'];
    tags?: string[];
    comment?: {
      body: string;
      public: boolean;
    };
    custom_fields?: Array<{ id: number; value: string }>;
  };
};
