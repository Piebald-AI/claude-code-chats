import React, { useState } from "react";
import { ChevronDown, ChevronRight, Terminal, FileText, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CodeBlock } from "@/components/CodeBlock";
import { TodoList } from "@/components/TodoList";
import ReactMarkdown from "react-markdown";
import type { ChatMessage, ContentBlock } from "@/types/chat";

interface MessageRendererProps {
  message: ChatMessage;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({ message }) => {
  // Handle simple text content
  if (typeof message.content === 'string') {
    return <MessageText content={message.content} />;
  }

  // Handle mixed content with blocks
  if (Array.isArray(message.content)) {
    return (
      <div className="space-y-3">
        {message.content.map((block, index) => (
          <ContentBlockRenderer key={index} block={block} />
        ))}
      </div>
    );
  }

  // Fallback for unexpected content structure
  return (
    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
      <div className="text-red-600 font-medium mb-2">Debug: Unexpected content structure</div>
      <pre className="whitespace-pre-wrap text-xs">
        {JSON.stringify(message.content, null, 2)}
      </pre>
    </div>
  );
};

interface ContentBlockRendererProps {
  block: ContentBlock;
}

const ContentBlockRenderer: React.FC<ContentBlockRendererProps> = ({ block }) => {
  // Handle the case where block_type might be undefined or empty
  // Also check for 'type' field as data might come with either field name
  const blockType = block.block_type || (block as any).type || 'unknown';
  
  switch (blockType) {
    case 'text':
      return <MessageText content={block.text || ''} />;
    
    case 'tool_use':
      return <ToolUseBlock block={block} />;
    
    case 'tool_result':
      return <ToolResultBlock block={block} />;
    
    default:
      return (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm">
          <div className="text-red-600 font-medium mb-2">
            Debug: Unknown block type "{blockType}"
          </div>
          <div className="text-xs text-gray-600 mb-2">
            Available fields: {Object.keys(block).join(', ')}
          </div>
          <pre className="whitespace-pre-wrap text-xs">
            {JSON.stringify(block, null, 2)}
          </pre>
        </div>
      );
  }
};

interface MessageTextProps {
  content: string;
}

const MessageText: React.FC<MessageTextProps> = ({ content }) => {
  if (!content.trim()) return null;

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown
        components={{
          code: ({ className, children, ...props }) => {
            // Check if this is inline code by looking at the parent node
            const isInline = !className?.includes('language-');
            
            // Handle inline code (e.g., `code` in text)
            if (isInline) {
              return (
                <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                  {children}
                </code>
              );
            }
            
            // For block code, extract language from className (format: language-xxx)
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'text';
            
            return (
              <CodeBlock
                language={language}
                code={String(children).replace(/\n$/, '')}
              />
            );
          },
          pre: ({ children }) => {
            // Don't wrap code blocks in additional pre tags since CodeBlock handles it
            return <>{children}</>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

interface ToolUseBlockProps {
  block: ContentBlock;
}

const ToolUseBlock: React.FC<ToolUseBlockProps> = ({ block }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-950/50 dark:border-blue-800">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start p-3 h-auto text-left hover:bg-blue-100 dark:hover:bg-blue-900/50"
          >
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Terminal className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="font-medium">Tool: {block.name}</span>
            </div>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2">
            {block.input && (
              <div>
                <div className="text-sm font-medium mb-1">Input:</div>
                <CodeBlock
                  language="json"
                  code={JSON.stringify(block.input, null, 2)}
                />
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

interface ToolResultBlockProps {
  block: ContentBlock;
}

const ToolResultBlock: React.FC<ToolResultBlockProps> = ({ block }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Check if this is a TodoWrite result by looking at the content
  const isTodoResult = block.content?.includes('Todos have been modified successfully') || 
                       block.content?.includes('todo list');

  // Try to extract todo data from the tool_use_result or content
  let todoData = null;
  if (isTodoResult) {
    // First try to get it from tool_use_result
    if (block.tool_use_result && block.tool_use_result.newTodos) {
      todoData = block.tool_use_result.newTodos;
    }
    // Fallback to parsing from content
    else if (block.content) {
      try {
        const jsonMatch = block.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.newTodos && Array.isArray(parsed.newTodos)) {
            todoData = parsed.newTodos;
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
  }

  // Hide tool results by default unless they contain todos
  if (!isTodoResult && !isExpanded) {
    return (
      <div className="border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-950/50 dark:border-gray-800">
        <Button
          variant="ghost"
          onClick={() => setIsExpanded(true)}
          className="w-full justify-start p-2 h-auto text-left hover:bg-gray-100 dark:hover:bg-gray-900/50"
        >
          <div className="flex items-center gap-2">
            <Eye className="h-3 w-3 text-gray-500" />
            <span className="text-sm text-gray-600">Show tool result</span>
          </div>
        </Button>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg ${
      isTodoResult 
        ? 'border-blue-200 bg-blue-50 dark:bg-blue-950/50 dark:border-blue-800' 
        : 'border-green-200 bg-green-50 dark:bg-green-950/50 dark:border-green-800'
    }`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={`w-full justify-start p-3 h-auto text-left ${
              isTodoResult 
                ? 'hover:bg-blue-100 dark:hover:bg-blue-900/50'
                : 'hover:bg-green-100 dark:hover:bg-green-900/50'
            }`}
          >
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <FileText className={`h-4 w-4 ${
                isTodoResult 
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-green-600 dark:text-green-400'
              }`} />
              <span className="font-medium">
                {isTodoResult ? 'Todo List Updated' : 'Tool Result'}
              </span>
            </div>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-3 pb-3">
            {isTodoResult && todoData ? (
              <div className="space-y-3">
                <TodoList todos={todoData} title="Current Tasks" />
                {showDebugInfo && block.content && (
                  <div className="bg-white dark:bg-gray-900 border rounded p-3 font-mono text-sm">
                    <MessageText content={block.content} />
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDebugInfo(!showDebugInfo)}
                  className="text-xs"
                >
                  {showDebugInfo ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                  {showDebugInfo ? 'Hide' : 'Show'} debug info
                </Button>
              </div>
            ) : block.content ? (
              <div className="bg-white dark:bg-gray-900 border rounded p-3 font-mono text-sm">
                <MessageText content={block.content} />
              </div>
            ) : (
              <div className="text-gray-500 italic">No content</div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};