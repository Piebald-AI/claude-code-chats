import { useQuery } from '@tanstack/react-query';
import { tauriApi } from '@/lib/tauri';

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => tauriApi.getAllProjects(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useChatMessages = (sessionId: string | null) => {
  return useQuery({
    queryKey: ['chatMessages', sessionId],
    queryFn: () => tauriApi.getChatMessages(sessionId!),
    enabled: !!sessionId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useSearchChats = (query: string) => {
  return useQuery({
    queryKey: ['searchChats', query],
    queryFn: () => tauriApi.searchChats(query),
    enabled: query.length >= 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};