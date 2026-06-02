export type EventStatus = "draft" | "active" | "closed" | "archived";

export type EventCardData = {
  id: string;
  slug: string;
  title: string;
  venue: string | null;
  datetime: string;
  createdAt: string;
  status: EventStatus;
  responseCount: number;
};
