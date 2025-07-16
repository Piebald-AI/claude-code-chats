import { useState } from "react";
import { MinimalSidebarProvider } from "@/components/MinimalSidebarProvider";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { AppSidebar } from "@/components/AppSidebar";
import { ChatViewer } from "@/components/ChatViewer";
import type { ChatSession } from "@/types/chat";

function App() {
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);

  return (
    <div className="h-screen">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
          <MinimalSidebarProvider>
            <AppSidebar 
              selectedSession={selectedSession}
              onSelectSession={setSelectedSession}
            />
          </MinimalSidebarProvider>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={75}>
          <ChatViewer selectedSession={selectedSession} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default App;
