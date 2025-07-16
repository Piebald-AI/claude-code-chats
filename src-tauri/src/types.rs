use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub title: String,
    pub timestamp: String,
    pub project_path: String,
    pub message_count: usize,
    pub last_updated: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub uuid: String,
    pub parent_uuid: Option<String>,
    pub timestamp: String,
    pub message_type: String, // "user" or "assistant"
    pub content: MessageContent,
    pub tool_use_id: Option<String>,
    pub cwd: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MessageContent {
    Text(String),
    Mixed(Vec<ContentBlock>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentBlock {
    #[serde(rename = "type")]
    pub block_type: String, // "text", "tool_use", "tool_result"
    pub text: Option<String>,
    pub name: Option<String>, // Tool name
    pub input: Option<serde_json::Value>,
    pub tool_use_id: Option<String>,
    pub content: Option<String>, // Tool result content
    pub tool_use_result: Option<serde_json::Value>, // For TodoWrite and other structured results
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectFolder {
    pub name: String,
    pub path: String,
    pub chat_sessions: Vec<ChatSession>,
}

// Raw JSONL message structure for parsing
#[derive(Debug, Deserialize)]
pub struct RawJsonlMessage {
    #[serde(rename = "parentUuid")]
    pub parent_uuid: Option<String>,
    #[serde(rename = "isSidechain")]
    pub is_sidechain: bool,
    #[serde(rename = "userType")]
    pub user_type: String,
    pub cwd: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub version: String,
    #[serde(rename = "type")]
    pub message_type: String,
    pub message: RawMessage,
    pub uuid: String,
    pub timestamp: String,
    #[serde(rename = "toolUseResult")]
    pub tool_use_result: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct RawMessage {
    pub role: String,
    pub content: serde_json::Value, // Can be string or array
    pub id: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub session_id: String,
    pub message_uuid: String,
    pub snippet: String,
    pub match_type: String, // "content", "tool_name", "tool_result"
}

impl ChatMessage {
    pub fn extract_text(&self) -> String {
        match &self.content {
            MessageContent::Text(text) => text.clone(),
            MessageContent::Mixed(blocks) => {
                blocks
                    .iter()
                    .filter_map(|block| block.text.as_ref())
                    .cloned()
                    .collect::<Vec<_>>()
                    .join("\n")
            }
        }
    }

    pub fn has_tool_calls(&self) -> bool {
        match &self.content {
            MessageContent::Text(_) => false,
            MessageContent::Mixed(blocks) => {
                blocks.iter().any(|block| block.block_type == "tool_use")
            }
        }
    }

    pub fn get_tool_calls(&self) -> Vec<&ContentBlock> {
        match &self.content {
            MessageContent::Text(_) => vec![],
            MessageContent::Mixed(blocks) => {
                blocks
                    .iter()
                    .filter(|block| block.block_type == "tool_use")
                    .collect()
            }
        }
    }
}

impl ChatSession {
    pub fn new(id: String, first_message: &ChatMessage, project_path: String) -> Self {
        let title = Self::generate_title(&first_message.extract_text());
        
        Self {
            id,
            title,
            timestamp: first_message.timestamp.clone(),
            project_path,
            message_count: 0,
            last_updated: first_message.timestamp.clone(),
        }
    }

    fn generate_title(content: &str) -> String {
        // Extract first meaningful line or first 50 chars
        let content = content.trim();
        if content.is_empty() {
            return "Untitled Chat".to_string();
        }

        // Remove command prefixes like <command-name>/init</command-name>
        let content = if content.starts_with('<') {
            content
                .lines()
                .find(|line| !line.trim().starts_with('<') && !line.trim().is_empty())
                .unwrap_or(content)
        } else {
            content
        };

        let first_line = content.lines().next().unwrap_or(content);
        if first_line.len() <= 50 {
            first_line.to_string()
        } else {
            format!("{}...", &first_line[..47])
        }
    }
}