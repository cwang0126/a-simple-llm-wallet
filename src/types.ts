export type Modality = "text" | "vision" | "audio" | "embedding" | "image-gen";

export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  contextWindow?: number;
  modalities: Modality[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletData {
  version: string;
  providers: Provider[];
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}
