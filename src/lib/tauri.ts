import { invoke } from '@tauri-apps/api/core';
import type { ChatMessage, ProjectFolder, SearchResult } from '@/types/chat';

export const tauriApi = {
  async getAllProjects(): Promise<ProjectFolder[]> {
    return await invoke('get_all_projects');
  },

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return await invoke('get_chat_messages', { sessionId });
  },

  async searchChats(query: string): Promise<SearchResult[]> {
    return await invoke('search_chats', { query });
  },

  async getSessionFilePath(sessionId: string): Promise<string> {
    return await invoke('get_session_file_path', { sessionId });
  },

  // Legacy greet function for testing
  async greet(name: string): Promise<string> {
    return await invoke('greet', { name });
  },
};