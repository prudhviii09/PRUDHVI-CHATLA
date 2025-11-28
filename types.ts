export enum Role {
  USER = 'user',
  MODEL = 'model',
}

export interface Attachment {
  mimeType: string;
  data: string; // base64
  previewUrl: string;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  attachments?: Attachment[];
  timestamp: number;
  isStreaming?: boolean;
  toolInvocations?: SystemAction[];
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export interface SystemAction {
  toolName: string;
  args: any;
  status: 'pending' | 'success' | 'failed';
  timestamp: number;
}

export type SystemActionCallback = (action: SystemAction) => void;
