export class AlarmRecord {
  id: string;
  appId: string;
  eventName: string;
  name: string;
  type: string;
  level: string;
  status: string;
  rule: string;
  message: string;
  data: Record<string, unknown> | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}
