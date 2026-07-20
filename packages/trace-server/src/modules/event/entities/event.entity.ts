export class Event {
  id: string;
  eventName: string;
  eventType: string;
  category: string;
  description: string | null;
  propertySchema: Record<string, any>;
  appId: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  deletedAt: Date | null;
}
