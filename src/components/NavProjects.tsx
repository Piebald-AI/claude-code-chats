import { Folder, MessageCircle, Clock, ChevronRight } from "lucide-react";
import {
  MinimalSidebarGroup,
  MinimalSidebarGroupLabel,
  MinimalSidebarMenu,
  MinimalSidebarMenuButton,
  MinimalSidebarMenuItem,
  MinimalSidebarMenuSub,
  MinimalSidebarMenuSubButton,
  MinimalSidebarMenuSubItem,
} from "@/components/ui/minimal-sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ProjectFolder, ChatSession } from "@/types/chat";

interface NavProjectsProps {
  projects: ProjectFolder[];
  selectedSession: ChatSession | null;
  onSelectSession: (session: ChatSession) => void;
}

export function NavProjects({ projects, selectedSession, onSelectSession }: NavProjectsProps) {
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (days === 1) {
        return 'Yesterday';
      } else if (days < 7) {
        return `${days} days ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch {
      return timestamp;
    }
  };

  return (
    <MinimalSidebarGroup>
      <MinimalSidebarGroupLabel>Projects</MinimalSidebarGroupLabel>
      <MinimalSidebarMenu>
        {projects.map((project) => (
          <Collapsible key={project.path} defaultOpen={true} className="group/collapsible">
            <MinimalSidebarMenuItem>
              <CollapsibleTrigger asChild>
                <MinimalSidebarMenuButton>
                  <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  <Folder className="h-4 w-4" />
                  <span>{project.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {project.chat_sessions.length}
                  </span>
                </MinimalSidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <MinimalSidebarMenuSub>
                  {project.chat_sessions.map((session) => (
                    <MinimalSidebarMenuSubItem key={session.id}>
                      <MinimalSidebarMenuSubButton
                        asChild
                        isActive={selectedSession?.id === session.id}
                      >
                        <button
                          onClick={() => onSelectSession(session)}
                          className="w-full text-left"
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span className="flex-1 truncate">{session.title}</span>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatTimestamp(session.last_updated)}</span>
                          </div>
                        </button>
                      </MinimalSidebarMenuSubButton>
                    </MinimalSidebarMenuSubItem>
                  ))}
                </MinimalSidebarMenuSub>
              </CollapsibleContent>
            </MinimalSidebarMenuItem>
          </Collapsible>
        ))}
      </MinimalSidebarMenu>
    </MinimalSidebarGroup>
  );
}
