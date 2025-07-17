export interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
  project_path: string;
  message_count: number;
  last_updated: string;
}

export interface ChatMessage {
  uuid: string;
  parent_uuid: string | null;
  timestamp: string;
  message_type: string; // "user" or "assistant"
  content: MessageContent;
  tool_use_id: string | null;
  cwd: string | null;
  version: string | null;
}

export type MessageContent = string | ContentBlock[];

export interface ContentBlock {
  block_type?: string; // "text", "tool_use", "tool_result", "thinking"
  type?: string; // Alternative field name for block_type
  text?: string;
  name?: string; // Tool name
  input?: any;
  tool_use_id?: string;
  content?: string; // Tool result content
  tool_use_result?: any; // For TodoWrite and other structured results
  thinking?: string; // For thinking blocks
}

export interface ProjectFolder {
  name: string;
  path: string;
  chat_sessions: ChatSession[];
}

export interface SearchResult {
  session_id: string;
  message_uuid: string;
  snippet: string;
  match_type: string; // "content", "tool_name", "tool_result"
}

// Utility function for processing backspace characters
function processBackspaces(text: string): string {
  if (!text.includes('\b')) {
    return text;
  }

  let result = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (char === '\b') {
      // Remove the last character from result if it exists
      if (result.length > 0) {
        result = result.slice(0, -1);
      }
      // Skip the backspace character itself
    } else {
      // Add the character to result
      result += char;
    }
  }
  
  return result;
}

// Helper functions
export const isTextContent = (content: MessageContent): content is string => {
  return typeof content === 'string';
};

export const isMixedContent = (content: MessageContent): content is ContentBlock[] => {
  return Array.isArray(content);
};

export const extractMessageText = (message: ChatMessage): string => {
  let rawText: string;
  
  if (typeof message.content === 'string') {
    rawText = message.content;
  } else if (Array.isArray(message.content)) {
    rawText = message.content
      .filter(block => block.text)
      .map(block => block.text!)
      .join('\n');
  } else {
    rawText = '';
  }
  
  return processBackspaces(rawText);
};

export const getToolCalls = (message: ChatMessage): ContentBlock[] => {
  if (typeof message.content === 'string') {
    return [];
  }
  
  if (Array.isArray(message.content)) {
    return message.content.filter(block => (block.block_type || block.type) === 'tool_use');
  }
  
  return [];
};

export const hasToolCalls = (message: ChatMessage): boolean => {
  return getToolCalls(message).length > 0;
};