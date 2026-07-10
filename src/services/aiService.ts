import { apiClient } from './apiClient';

interface ChatMessage {
  text: string;
  isUser: boolean;
}

interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}

interface AIChatResponse {
  reply: string;
  safetyNote?: string;
}

export interface AIKnowledgeItem {
  icon: 'bulb' | 'heart' | 'star' | 'nutrition' | 'fitness' | 'sparkles' | 'medkit' | 'happy';
  title: string;
  text: string;
  source: string;
}

export const aiService = {
  async chat(messages: ChatMessage[]): Promise<AIChatResponse> {
    const res = await apiClient.post<ApiResponse<AIChatResponse>>('/ai/chat', { messages });
    return res.data;
  },

  async getKnowledge(): Promise<AIKnowledgeItem> {
    const res = await apiClient.get<ApiResponse<AIKnowledgeItem>>('/ai/knowledge');
    return res.data;
  },
};
