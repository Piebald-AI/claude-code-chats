// This component is deprecated and replaced by AppSidebar
// Keeping it for backwards compatibility during transition
import React from "react";
import type { ProjectFolder, ChatSession } from "@/types/chat";
import { AppSidebar } from "@/components/AppSidebar";

interface ChatListProps {
  projects: ProjectFolder[];
  selectedSession: ChatSession | null;
  onSelectSession: (session: ChatSession) => void;
}

export const ChatList: React.FC<ChatListProps> = ({
  selectedSession,
  onSelectSession,
}) => {
  return (
    <AppSidebar 
      selectedSession={selectedSession}
      onSelectSession={onSelectSession}
    />
  );
};