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

export type Theme = "light" | "dark";

export type ViewMode = "list" | "detail" | "add" | "edit" | "chat" | "export";
