import React, { useEffect, useRef } from "react";
import { MessageSquare, User, Bot, Clock, MoreHorizontal, Copy, ExternalLink } from "lucide-react";
import { useChatMessages } from "@/hooks/useChats";
import { MessageRenderer } from "@/components/MessageRenderer";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ChatSession, ChatMessage } from "@/types/chat";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { openPath } from "@tauri-apps/plugin-opener";
import { tauriApi } from "@/lib/tauri";

interface ChatViewerProps {
  selectedSession: ChatSession | null;
}

export const ChatViewer: React.FC<ChatViewerProps> = ({ selectedSession }) => {
  const { data: messages, isLoading, error } = useChatMessages(selectedSession?.id || null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to top when a new chat is selected
  useEffect(() => {
    if (selectedSession && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = 0;
    }
  }, [selectedSession?.id]);

  if (!selectedSession) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <MessageSquare className="h-12 w-12 mb-4" />
        <h2 className="text-lg font-medium mb-2">Select a chat to view</h2>
        <p className="text-sm text-center max-w-md">
          Choose a chat from the sidebar to view its messages and conversation history.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b p-4">
          <Skeleton className="h-6 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-500">
        <MessageSquare className="h-12 w-12 mb-4" />
        <h2 className="text-lg font-medium mb-2">Error loading messages</h2>
        <p className="text-sm text-center max-w-md">
          {error.message}
        </p>
      </div>
    );
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const handleCopyPath = async () => {
    try {
      const filePath = await tauriApi.getSessionFilePath(selectedSession.id);
      await navigator.clipboard.writeText(filePath);
    } catch (error) {
      console.error('Failed to copy path:', error);
    }
  };

  const handleOpenFile = async () => {
    try {
      const filePath = await tauriApi.getSessionFilePath(selectedSession.id);
      await openPath(filePath);
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b p-4 bg-muted/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold truncate">{selectedSession.title}</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopyPath}>
                <Copy className="mr-2 h-4 w-4" />
                Copy JSONL Path
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleOpenFile}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open JSONL File
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTimestamp(selectedSession.last_updated)}
          </span>
          <span>{selectedSession.message_count} messages</span>
          <span className="truncate">
            {selectedSession.project_path.split('\\').pop() || selectedSession.project_path}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
        <div className="max-w-4xl mx-auto p-4">
          {messages?.map((message) => (
            <MessageBlock key={message.uuid} message={message} />
          ))}
          
          {(!messages || messages.length === 0) && (
            <div className="text-center text-muted-foreground py-8">
              No messages in this chat.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface MessageBlockProps {
  message: ChatMessage;
}

const MessageBlock: React.FC<MessageBlockProps> = ({ message }) => {
  const isUser = message.message_type === "user";
  const isAssistant = message.message_type === "assistant";

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className={cn(
      "group relative mb-6 rounded-lg border p-4",
      isUser && "bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800",
      isAssistant && "bg-gray-50 border-gray-200 dark:bg-gray-950/50 dark:border-gray-800"
    )}>
      {/* Message Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full",
          isUser && "bg-blue-500 text-white",
          isAssistant && "bg-gray-500 text-white"
        )}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {isUser ? "You" : (message.model || "Claude")}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
        </div>
      </div>

      {/* Message Content */}
      <div className="ml-11">
        <MessageRenderer message={message} />
      </div>
    </div>
  );
};