import React, { useState, useEffect } from "react";
import { Search, MessageCircle, FileText, Wrench, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useSearchChats, useProjects } from "@/hooks/useChats";
import type { SearchResult, ChatSession } from "@/types/chat";

interface SearchInterfaceProps {
  onSelectSession: (session: ChatSession) => void;
  onClose: () => void;
}

export const SearchInterface: React.FC<SearchInterfaceProps> = ({
  onSelectSession,
}) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  
  const { data: projects } = useProjects();
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query]);

  const { data: searchResults, isLoading, error } = useSearchChats(debouncedQuery);

  const getMatchTypeIcon = (matchType: string) => {
    switch (matchType) {
      case "content":
        return <MessageCircle className="h-4 w-4" />;
      case "tool_name":
        return <Wrench className="h-4 w-4" />;
      case "tool_input":
        return <Wrench className="h-4 w-4" />;
      case "tool_result":
        return <FileText className="h-4 w-4" />;
      case "tool_structured_result":
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
      case "tool_input":
        return "bg-orange-100 text-orange-800";
      case "tool_result":
        return "bg-purple-100 text-purple-800";
      case "tool_structured_result":
        return "bg-indigo-100 text-indigo-800";
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
      case "tool_input":
        return "Input";
      case "tool_result":
        return "Result";
      case "tool_structured_result":
        return "Data";
      default:
        return "Match";
    }
  };

  const handleResultClick = (result: SearchResult) => {
    // Find the actual session from projects data
    if (projects) {
      for (const project of projects) {
        const session = project.chat_sessions.find(s => s.id === result.session_id);
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
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <div className="flex flex-col h-full bg-background border-r">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <Search className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Claude Code Chats</h2>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search across all messages, tools, inputs, and results..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>
      </div>

      {/* Search Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {!debouncedQuery ? (
          <div className="text-center text-muted-foreground py-8">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Enter a search query to find content across all your chats</p>
            <p className="text-sm mt-2">
              Search includes message content, tool names, inputs, and results
            </p>
          </div>
        ) : isLoading ? (
          <div className="text-center text-muted-foreground py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Searching...</p>
          </div>
        ) : error ? (
          <div className="text-center text-destructive py-8">
            <p>Error occurred while searching</p>
            <p className="text-sm mt-2">{error.message}</p>
          </div>
        ) : searchResults && searchResults.length > 0 ? (
          <div className="space-y-3">
            {searchResults.map((result, index) => (
              <div
                key={`${result.session_id}-${result.message_uuid}-${index}`}
                className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                onClick={() => handleResultClick(result)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getMatchTypeIcon(result.match_type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="secondary"
                        className={cn("text-xs", getMatchTypeColor(result.match_type))}
                      >
                        {getMatchTypeLabel(result.match_type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Session: {result.session_id.slice(0, 8)}...
                      </span>
                    </div>
                    
                    <p className="text-sm leading-relaxed">
                      {highlightText(result.snippet, debouncedQuery)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No results found for "{debouncedQuery}"</p>
            <p className="text-sm mt-2">
              Try different keywords or check your spelling
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {searchResults && searchResults.length > 0 && (
        <>
          <Separator />
          <div className="p-4 text-sm text-muted-foreground">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
          </div>
        </>
      )}
    </div>
  );
};