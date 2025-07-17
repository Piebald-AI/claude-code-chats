import { useState, useEffect } from "react";
import { Search, MessageCircle, FileText, Wrench, Hash, Brain, Filter, X } from "lucide-react";
import {
  MinimalSidebarInput,
  MinimalSidebarMenu,
  MinimalSidebarMenuButton,
  MinimalSidebarMenuItem,
  MinimalSidebarGroup,
  MinimalSidebarGroupLabel,
} from "@/components/ui/minimal-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { NavProjects } from "@/components/NavProjects";
import { useProjects, useSearchChats } from "@/hooks/useChats";
import type { ChatSession, SearchResult } from "@/types/chat";

interface AppSidebarProps {
  selectedSession: ChatSession | null;
  onSelectSession: (session: ChatSession) => void;
}

const ALL_MATCH_TYPES = [
  "content",
  "thinking", 
  "tool_name",
  "tool_input",
  "tool_result",
  "tool_structured_result"
] as const;

export function AppSidebar({
  selectedSession,
  onSelectSession,
}: AppSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(ALL_MATCH_TYPES));
  const [showFilters, setShowFilters] = useState(false);

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

  // Filter search results based on active filters
  const filteredResults = searchResults?.filter(result => 
    activeFilters.has(result.match_type)
  );

  const toggleFilter = (matchType: string) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (newFilters.has(matchType)) {
        newFilters.delete(matchType);
      } else {
        newFilters.add(matchType);
      }
      return newFilters;
    });
  };

  const toggleAllFilters = () => {
    if (activeFilters.size === ALL_MATCH_TYPES.length) {
      setActiveFilters(new Set());
    } else {
      setActiveFilters(new Set(ALL_MATCH_TYPES));
    }
  };

  const clearFilters = () => {
    setActiveFilters(new Set(ALL_MATCH_TYPES));
  };

  const getMatchTypeIcon = (matchType: string) => {
    switch (matchType) {
      case "content":
        return <MessageCircle className="h-4 w-4" />;
      case "thinking":
        return <Brain className="h-4 w-4" />;
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
        return "bg-blue-100 text-blue-800 dark:bg-blue-800/50 dark:text-blue-200";
      case "thinking":
        return "bg-purple-100 text-purple-800 dark:bg-purple-800/50 dark:text-purple-200";
      case "tool_name":
        return "bg-green-100 text-green-800 dark:bg-green-800/50 dark:text-green-200";
      case "tool_input":
        return "bg-orange-100 text-orange-800 dark:bg-orange-800/50 dark:text-orange-200";
      case "tool_result":
        return "bg-purple-100 text-purple-800 dark:bg-purple-800/50 dark:text-purple-200";
      case "tool_structured_result":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-800/50 dark:text-indigo-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-600/50 dark:text-gray-200";
    }
  };

  const getMatchTypeLabel = (matchType: string) => {
    switch (matchType) {
      case "content":
        return "Message";
      case "thinking":
        return "Thinking";
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

    // Escape special regex characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800/60 dark:text-yellow-100 px-1 rounded">
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
        
        {isSearchMode && (
          <div className="flex items-center gap-2 px-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-8 flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFilters.size < ALL_MATCH_TYPES.length && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {activeFilters.size}
                </Badge>
              )}
            </Button>
            {activeFilters.size < ALL_MATCH_TYPES.length && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>
        )}
        
        {isSearchMode && (
          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <CollapsibleContent>
              <div className="px-2 py-2 space-y-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Filter by type:</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAllFilters}
                    className="h-6 text-xs"
                  >
                    {activeFilters.size === ALL_MATCH_TYPES.length ? "None" : "All"}
                  </Button>
                </div>
                <div className="space-y-1">
                  {ALL_MATCH_TYPES.map((matchType) => (
                    <div key={matchType} className="flex items-center space-x-2">
                      <Checkbox
                        id={matchType}
                        checked={activeFilters.has(matchType)}
                        onCheckedChange={() => toggleFilter(matchType)}
                      />
                      <label
                        htmlFor={matchType}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        {getMatchTypeIcon(matchType)}
                        <span>{getMatchTypeLabel(matchType)}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
        {isSearchMode ? (
          <MinimalSidebarGroup>
            <MinimalSidebarGroupLabel>
              Search Results
              {searchResults && filteredResults && (
                ` (${filteredResults.length}${filteredResults.length !== searchResults.length ? ` of ${searchResults.length}` : ''})`
              )}
            </MinimalSidebarGroupLabel>
            <MinimalSidebarMenu>
              {isLoading ? (
                <MinimalSidebarMenuItem>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-sm">Searching...</span>
                  </div>
                </MinimalSidebarMenuItem>
              ) : !filteredResults || filteredResults.length === 0 ? (
                <MinimalSidebarMenuItem>
                  <div className="px-2 py-1 text-sm text-muted-foreground">
                    {debouncedQuery ? (
                      searchResults && searchResults.length > 0 ? (
                        <>
                          No results match current filters
                          <br />
                          <span className="text-xs opacity-75">
                            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} available
                          </span>
                        </>
                      ) : (
                        `No results for "${debouncedQuery}"`
                      )
                    ) : (
                      "Start typing to search..."
                    )}
                  </div>
                </MinimalSidebarMenuItem>
              ) : (
                filteredResults.map((result, index) => (
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
