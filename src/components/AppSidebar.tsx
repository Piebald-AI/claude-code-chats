import { useState, useEffect } from "react";
import { Search, MessageCircle, FileText, Wrench, Hash } from "lucide-react";
import {
  MinimalSidebarInput,
  MinimalSidebarMenu,
  MinimalSidebarMenuButton,
  MinimalSidebarMenuItem,
  MinimalSidebarGroup,
  MinimalSidebarGroupLabel,
  MinimalSidebarSeparator,
} from "@/components/ui/minimal-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NavProjects } from "@/components/NavProjects";
import { useProjects, useSearchChats } from "@/hooks/useChats";
import type { ChatSession, SearchResult } from "@/types/chat";

interface AppSidebarProps {
  selectedSession: ChatSession | null;
  onSelectSession: (session: ChatSession) => void;
}

export function AppSidebar({
  selectedSession,
  onSelectSession,
}: AppSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);

  const { data: projects } = useProjects();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Enter search mode when user types
  useEffect(() => {
    setIsSearchMode(searchQuery.length > 0);
  }, [searchQuery]);

  const { data: searchResults, isLoading } = useSearchChats(debouncedQuery);

  const getMatchTypeIcon = (matchType: string) => {
    switch (matchType) {
      case "content":
        return <MessageCircle className="h-4 w-4" />;
      case "tool_name":
        return <Wrench className="h-4 w-4" />;
      case "tool_result":
        return <FileText className="h-4 w-4" />;
      default:
        return <Hash className="h-4 w-4" />;
    }
  };

  const getMatchTypeColor = (matchType: string) => {
    switch (matchType) {
      case "content":
        return "bg-blue-100 text-blue-800";
      case "tool_name":
        return "bg-green-100 text-green-800";
      case "tool_result":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getMatchTypeLabel = (matchType: string) => {
    switch (matchType) {
      case "content":
        return "Message";
      case "tool_name":
        return "Tool";
      case "tool_result":
        return "Result";
      default:
        return "Match";
    }
  };

  const handleSearchResultClick = (result: SearchResult) => {
    // Find the actual session from projects data
    if (projects) {
      for (const project of projects) {
        const session = project.chat_sessions.find(
          (s) => s.id === result.session_id
        );
        if (session) {
          onSelectSession(session);
          return;
        }
      }
    }

    // Fallback if session not found in projects
    const fallbackSession: ChatSession = {
      id: result.session_id,
      title: `Search Result: ${result.snippet.slice(0, 50)}...`,
      timestamp: new Date().toISOString(),
      project_path: "",
      message_count: 0,
      last_updated: new Date().toISOString(),
    };
    onSelectSession(fallbackSession);
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="flex flex-col gap-2 p-2">
        <h2 className="text-lg font-semibold px-2">Claude Code Chats</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <MinimalSidebarInput
            placeholder="Search chats, messages, tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
        {isSearchMode ? (
          <MinimalSidebarGroup>
            <MinimalSidebarGroupLabel>
              Search Results
              {searchResults && ` (${searchResults.length})`}
            </MinimalSidebarGroupLabel>
            <MinimalSidebarMenu>
              {isLoading ? (
                <MinimalSidebarMenuItem>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-sm">Searching...</span>
                  </div>
                </MinimalSidebarMenuItem>
              ) : !searchResults || searchResults.length === 0 ? (
                <MinimalSidebarMenuItem>
                  <div className="px-2 py-1 text-sm text-muted-foreground">
                    {debouncedQuery
                      ? `No results for "${debouncedQuery}"`
                      : "Start typing to search..."}
                  </div>
                </MinimalSidebarMenuItem>
              ) : (
                searchResults.map((result, index) => (
                  <MinimalSidebarMenuItem
                    key={`${result.session_id}-${result.message_uuid}-${index}`}
                  >
                    <MinimalSidebarMenuButton
                      onClick={() => handleSearchResultClick(result)}
                      className="h-auto p-2 flex-col items-start gap-1"
                    >
                      <div className="flex items-center gap-2 w-full">
                        {getMatchTypeIcon(result.match_type)}
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            getMatchTypeColor(result.match_type)
                          )}
                        >
                          {getMatchTypeLabel(result.match_type)}
                        </Badge>
                      </div>
                      <div className="text-xs text-left w-full">
                        {highlightText(result.snippet, debouncedQuery)}
                      </div>
                    </MinimalSidebarMenuButton>
                  </MinimalSidebarMenuItem>
                ))
              )}
            </MinimalSidebarMenu>
          </MinimalSidebarGroup>
        ) : (
          <NavProjects
            projects={projects || []}
            selectedSession={selectedSession}
            onSelectSession={onSelectSession}
          />
        )}
      </div>
    </div>
  );
}
