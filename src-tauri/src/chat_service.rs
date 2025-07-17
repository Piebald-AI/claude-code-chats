use crate::types::*;
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::{AsyncBufReadExt, BufReader};

pub struct ChatService {
    projects_path: PathBuf,
}

impl ChatService {
    pub fn new() -> Self {
        let projects_path = dirs::home_dir()
            .expect("Unable to determine home directory")
            .join(".claude")
            .join("projects");
        Self { projects_path }
    }

    pub async fn get_all_projects(&self) -> Result<Vec<ProjectFolder>> {
        let mut projects = Vec::new();
        let mut entries = fs::read_dir(&self.projects_path).await?;

        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                let project_path = entry.path();
                
                let sessions = self.get_project_sessions(&project_path).await?;
                
                if !sessions.is_empty() {
                    // Use the real project path from the first session's cwd property
                    let project_name = sessions[0].project_path.clone();
                    
                    projects.push(ProjectFolder {
                        name: project_name,
                        path: project_path.to_string_lossy().to_string(),
                        chat_sessions: sessions,
                    });
                }
            }
        }

        // Sort projects by most recent activity
        projects.sort_by(|a, b| {
            let empty_string = String::new();
            let a_latest = a.chat_sessions.iter()
                .map(|s| &s.last_updated)
                .max()
                .unwrap_or(&empty_string);
            let b_latest = b.chat_sessions.iter()
                .map(|s| &s.last_updated)
                .max()
                .unwrap_or(&empty_string);
            b_latest.cmp(a_latest)
        });

        Ok(projects)
    }

    pub async fn get_project_sessions(&self, project_path: &Path) -> Result<Vec<ChatSession>> {
        let mut sessions = Vec::new();
        
        // Build summary index upfront for this project
        let summary_index = self.build_summary_index(project_path).await;
        
        let mut entries = fs::read_dir(project_path).await?;

        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_file() {
                let file_path = entry.path();
                if file_path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                    if let Ok(session) = self.parse_session_from_file_with_index(&file_path, &summary_index).await {
                        sessions.push(session);
                    }
                }
            }
        }

        // Sort by most recent first
        sessions.sort_by(|a, b| b.last_updated.cmp(&a.last_updated));
        Ok(sessions)
    }

    pub async fn get_chat_messages(&self, session_id: &str) -> Result<Vec<ChatMessage>> {
        // Find the JSONL file for this session
        let jsonl_path = self.find_session_file(session_id).await?;
        self.parse_messages_from_file(&jsonl_path).await
    }

    async fn find_session_file(&self, session_id: &str) -> Result<PathBuf> {
        let mut entries = fs::read_dir(&self.projects_path).await?;

        while let Some(project_entry) = entries.next_entry().await? {
            if project_entry.file_type().await?.is_dir() {
                let mut project_files = fs::read_dir(project_entry.path()).await?;
                
                while let Some(file_entry) = project_files.next_entry().await? {
                    if file_entry.file_type().await?.is_file() {
                        let file_path = file_entry.path();
                        if file_path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                            // Check if this file contains our session by reading through lines
                            if self.file_contains_session_id(&file_path, session_id).await? {
                                return Ok(file_path);
                            }
                        }
                    }
                }
            }
        }

        Err(anyhow::anyhow!("Session file not found for ID: {}", session_id))
    }

    async fn file_contains_session_id(&self, file_path: &Path, session_id: &str) -> Result<bool> {
        let file = fs::File::open(file_path).await?;
        let reader = BufReader::new(file);
        let mut lines = reader.lines();
        
        while let Some(line) = lines.next_line().await? {
            if line.trim().is_empty() {
                continue;
            }
            
            // Skip summary objects - they won't contain sessionId
            if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&line) {
                if let Some(line_type) = json_value.get("type").and_then(|v| v.as_str()) {
                    if line_type == "summary" {
                        continue;
                    }
                }
            }
            
            // Check if this line contains our session ID
            if line.contains(&format!("\"sessionId\":\"{}\"", session_id)) {
                return Ok(true);
            }
        }
        
        Ok(false)
    }


    async fn parse_session_from_file_with_index(&self, file_path: &Path, summary_index: &HashMap<String, String>) -> Result<ChatSession> {
        let file = fs::File::open(file_path).await?;
        let reader = BufReader::new(file);
        let mut lines = reader.lines();
        
        let mut session_id = String::new();
        let mut project_path = String::new();
        let mut first_message: Option<ChatMessage> = None;
        let mut message_count = 0;
        let mut last_updated = String::new();
        let mut last_message_uuid = String::new();

        while let Some(line) = lines.next_line().await? {
            if line.trim().is_empty() {
                continue;
            }

            // First check if this is a summary object - if so, skip it
            if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&line) {
                if let Some(line_type) = json_value.get("type").and_then(|v| v.as_str()) {
                    if line_type == "summary" {
                        continue; // Skip summary objects
                    }
                }
            }

            let raw_msg: RawJsonlMessage = serde_json::from_str(&line)
                .context("Failed to parse JSONL line")?;

            if session_id.is_empty() {
                session_id = raw_msg.session_id.clone();
                project_path = raw_msg.cwd.clone();
            }

            if raw_msg.message_type == "user" || raw_msg.message_type == "assistant" {
                message_count += 1;
                last_updated = raw_msg.timestamp.clone();
                last_message_uuid = raw_msg.uuid.clone();

                if first_message.is_none() && raw_msg.message_type == "user" {
                    let chat_msg = self.convert_raw_to_chat_message(&raw_msg)?;
                    first_message = Some(chat_msg);
                }
            }
        }

        if let Some(first_msg) = first_message {
            // Look up summary from index (much faster than file scanning)
            let summary_title = summary_index.get(&last_message_uuid).cloned();
            
            let mut session = ChatSession::new_with_summary(session_id, &first_msg, project_path, summary_title);
            session.message_count = message_count;
            session.last_updated = last_updated;
            Ok(session)
        } else {
            Err(anyhow::anyhow!("No valid messages found in file"))
        }
    }

    async fn build_summary_index(&self, project_path: &Path) -> HashMap<String, String> {
        let mut summary_index = HashMap::new();
        
        if let Ok(mut entries) = fs::read_dir(project_path).await {
            while let Some(entry) = entries.next_entry().await.ok().flatten() {
                if entry.file_type().await.ok().map_or(false, |ft| ft.is_file()) {
                    let file_path = entry.path();
                    if file_path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                        if let Ok(file) = fs::File::open(&file_path).await {
                            let reader = BufReader::new(file);
                            let mut lines = reader.lines();
                            
                            while let Some(line) = lines.next_line().await.ok().flatten() {
                                if line.trim().is_empty() {
                                    continue;
                                }
                                
                                if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&line) {
                                    if let Some(line_type) = json_value.get("type").and_then(|v| v.as_str()) {
                                        if line_type == "summary" {
                                            if let (Some(leaf_uuid), Some(summary)) = (
                                                json_value.get("leafUuid").and_then(|v| v.as_str()),
                                                json_value.get("summary").and_then(|v| v.as_str())
                                            ) {
                                                summary_index.insert(leaf_uuid.to_string(), summary.to_string());
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        summary_index
    }

    async fn parse_messages_from_file(&self, file_path: &Path) -> Result<Vec<ChatMessage>> {
        let file = fs::File::open(file_path).await?;
        let reader = BufReader::new(file);
        let mut lines = reader.lines();
        let mut messages = Vec::new();

        while let Some(line) = lines.next_line().await? {
            if line.trim().is_empty() {
                continue;
            }

            // First check if this is a summary object - if so, skip it
            if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&line) {
                if let Some(line_type) = json_value.get("type").and_then(|v| v.as_str()) {
                    if line_type == "summary" {
                        continue; // Skip summary objects
                    }
                }
            }

            if let Ok(raw_msg) = serde_json::from_str::<RawJsonlMessage>(&line) {
                if raw_msg.message_type == "user" || raw_msg.message_type == "assistant" {
                    if let Ok(chat_msg) = self.convert_raw_to_chat_message(&raw_msg) {
                        // Check if we should merge this message with the previous one based on message ID
                        if self.should_merge_by_message_id(&chat_msg, &raw_msg, &messages) {
                            self.merge_with_previous_by_id(&chat_msg, &mut messages);
                        } else if self.should_merge_tool_results_with_assistant(&chat_msg, &messages) {
                            self.merge_tool_results_with_assistant(&chat_msg, &mut messages);
                        } else {
                            messages.push(chat_msg);
                        }
                    }
                }
            }
        }

        Ok(messages)
    }




    fn should_merge_by_message_id(&self, current_msg: &ChatMessage, raw_msg: &RawJsonlMessage, messages: &[ChatMessage]) -> bool {
        // Check if this message has the same ID as the previous message
        if let Some(message_id) = &raw_msg.message.id {
            if let Some(prev_msg) = messages.last() {
                // Both messages must be assistant messages
                if prev_msg.message_type == "assistant" && current_msg.message_type == "assistant" {
                    // Check if the previous message's uuid ends with the same message ID
                    return prev_msg.uuid.ends_with(message_id);
                }
            }
        }
        false
    }

    fn merge_with_previous_by_id(&self, current_msg: &ChatMessage, messages: &mut Vec<ChatMessage>) {
        if let Some(prev_msg) = messages.last_mut() {
            // Merge content blocks from current message into previous message
            match (&mut prev_msg.content, &current_msg.content) {
                (MessageContent::Text(prev_text), MessageContent::Mixed(current_blocks)) => {
                    // Convert previous text to mixed content and add current blocks
                    let mut blocks = vec![ContentBlock {
                        block_type: "text".to_string(),
                        text: Some(prev_text.clone()),
                        name: None,
                        input: None,
                        tool_use_id: None,
                        content: None,
                        tool_use_result: None,
                        thinking: None,
                    }];
                    blocks.extend(current_blocks.clone());
                    prev_msg.content = MessageContent::Mixed(blocks);
                }
                (MessageContent::Mixed(prev_blocks), MessageContent::Mixed(current_blocks)) => {
                    // Add current blocks to previous blocks
                    prev_blocks.extend(current_blocks.clone());
                }
                (MessageContent::Mixed(prev_blocks), MessageContent::Text(current_text)) => {
                    // Add current text as a text block
                    prev_blocks.push(ContentBlock {
                        block_type: "text".to_string(),
                        text: Some(current_text.clone()),
                        name: None,
                        input: None,
                        tool_use_id: None,
                        content: None,
                        tool_use_result: None,
                        thinking: None,
                    });
                }
                _ => {} // Other combinations are less common
            }
        }
    }

    fn should_merge_tool_results_with_assistant(&self, current_msg: &ChatMessage, messages: &[ChatMessage]) -> bool {
        // Check if current message is a user message containing only tool results
        if current_msg.message_type != "user" {
            return false;
        }

        // Check if current message contains tool results
        let has_tool_results = match &current_msg.content {
            MessageContent::Mixed(blocks) => {
                blocks.iter().any(|block| block.block_type == "tool_result")
            }
            _ => false,
        };

        if !has_tool_results {
            return false;
        }

        // Check if previous message is an assistant message with tool calls
        if let Some(prev_msg) = messages.last() {
            prev_msg.message_type == "assistant" && prev_msg.has_tool_calls()
        } else {
            false
        }
    }

    fn merge_tool_results_with_assistant(&self, current_msg: &ChatMessage, messages: &mut Vec<ChatMessage>) {
        if let Some(prev_msg) = messages.last_mut() {
            if let MessageContent::Mixed(current_blocks) = &current_msg.content {
                // Find tool results in current message
                let tool_results: Vec<&ContentBlock> = current_blocks
                    .iter()
                    .filter(|block| block.block_type == "tool_result")
                    .collect();

                // Add tool results to the previous assistant message
                if let MessageContent::Mixed(prev_blocks) = &mut prev_msg.content {
                    // Match tool results to tool calls by tool_use_id
                    for tool_result in tool_results {
                        if let Some(tool_use_id) = &tool_result.tool_use_id {
                            // Find the matching tool call and add the result
                            for block in prev_blocks.iter_mut() {
                                if block.block_type == "tool_use" && 
                                   block.tool_use_id.as_ref() == Some(tool_use_id) {
                                    // Add result data to the tool use block
                                    block.content = tool_result.content.clone();
                                    block.tool_use_result = tool_result.tool_use_result.clone();
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    fn convert_raw_to_chat_message(&self, raw: &RawJsonlMessage) -> Result<ChatMessage> {
        let mut content = self.parse_message_content(&raw.message.content)?;
        
        // If this is a tool result message and has toolUseResult, add it to content blocks
        if raw.message_type == "user" && raw.tool_use_result.is_some() {
            if let MessageContent::Mixed(ref mut blocks) = content {
                for block in blocks.iter_mut() {
                    if block.block_type == "tool_result" {
                        block.tool_use_result = raw.tool_use_result.clone();
                    }
                }
            }
        }
        
        // Create a composite uuid that includes both the line uuid and message ID for grouping
        let uuid = if let Some(message_id) = &raw.message.id {
            format!("{}#{}", raw.uuid, message_id)
        } else {
            raw.uuid.clone()
        };
        
        Ok(ChatMessage {
            uuid,
            parent_uuid: raw.parent_uuid.clone(),
            timestamp: raw.timestamp.clone(),
            message_type: raw.message_type.clone(),
            content,
            tool_use_id: None, // Will be populated from content blocks if needed
            cwd: Some(raw.cwd.clone()),
            version: Some(raw.version.clone()),
            model: raw.message.model.clone(),
        })
    }

    fn parse_message_content(&self, content: &serde_json::Value) -> Result<MessageContent> {
        match content {
            serde_json::Value::String(text) => Ok(MessageContent::Text(text.clone())),
            serde_json::Value::Array(blocks) => {
                let mut content_blocks = Vec::new();
                
                for block in blocks {
                    if let Ok(content_block) = self.parse_content_block(block) {
                        content_blocks.push(content_block);
                    }
                }
                
                Ok(MessageContent::Mixed(content_blocks))
            }
            _ => Ok(MessageContent::Text(content.to_string())),
        }
    }

    fn parse_content_block(&self, block: &serde_json::Value) -> Result<ContentBlock> {
        let block_type = block.get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let text = block.get("text")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let name = block.get("name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let input = block.get("input").cloned();

        // For tool_use blocks, the ID is in the "id" field
        // For tool_result blocks, the ID is in the "tool_use_id" field
        let tool_use_id = if block_type == "tool_use" {
            block.get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        } else {
            block.get("tool_use_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        };

        let content = block.get("content")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let thinking = block.get("thinking")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Ok(ContentBlock {
            block_type,
            text,
            name,
            input,
            tool_use_id,
            content,
            tool_use_result: None, // Will be populated later if needed
            thinking,
        })
    }

    pub async fn search_chats(&self, query: &str) -> Result<Vec<SearchResult>> {
        let mut results = Vec::new();
        let query_lower = query.to_lowercase();
        // const MAX_RESULTS: usize = 50; // Limit results for performance
        
        // Get all project directories
        let mut project_entries = fs::read_dir(&self.projects_path).await?;
        
        while let Some(project_entry) = project_entries.next_entry().await? {
            if !project_entry.file_type().await?.is_dir() {
                continue;
            }
            
            let project_path = project_entry.path();
            let mut file_entries = fs::read_dir(&project_path).await?;
            
            while let Some(file_entry) = file_entries.next_entry().await? {
                if !file_entry.file_type().await?.is_file() {
                    continue;
                }
                
                let file_path = file_entry.path();
                if file_path.extension().and_then(|s| s.to_str()) != Some("jsonl") {
                    continue;
                }
                
                // Stream search through this file
                if let Ok(file_results) = self.search_file_streaming(&file_path, &query_lower).await {
                    results.extend(file_results);
                    
                    // Early termination if we have enough results
                    // if results.len() >= MAX_RESULTS {
                    //     results.truncate(MAX_RESULTS);
                    //     return Ok(results);
                    // }
                }
            }
        }
        
        // Sort by relevance (could be improved with scoring)
        results.sort_by(|a, b| {
            // Prefer content matches over tool matches
            let a_priority = match a.match_type.as_str() {
                "content" => 0,
                "thinking" => 1,
                "tool_name" => 2,
                "tool_input" => 3,
                "tool_result" => 4,
                _ => 5,
            };
            let b_priority = match b.match_type.as_str() {
                "content" => 0,
                "thinking" => 1,
                "tool_name" => 2,
                "tool_input" => 3,
                "tool_result" => 4,
                _ => 5,
            };
            a_priority.cmp(&b_priority)
        });
        
        Ok(results)
    }
    
    async fn search_file_streaming(&self, file_path: &Path, query_lower: &str) -> Result<Vec<SearchResult>> {
        let mut results = Vec::new();
        let file = fs::File::open(file_path).await?;
        let reader = BufReader::new(file);
        let mut lines = reader.lines();
        
        let mut current_session_id: Option<String> = None;
        
        while let Some(line) = lines.next_line().await? {
            if line.trim().is_empty() {
                continue;
            }
            
            // Fast summary detection - check for summary type before JSON parsing
            if line.contains("\"type\":\"summary\"") {
                continue;
            }
            
            // Fast query matching - check if line contains query before JSON parsing
            if !line.to_lowercase().contains(query_lower) {
                // Still need to extract session ID for context
                if current_session_id.is_none() {
                    if let Some(session_id) = self.extract_session_id_fast(&line) {
                        current_session_id = Some(session_id);
                    }
                }
                continue;
            }
            
            // Parse JSON only for matching lines
            if let Ok(raw_msg) = serde_json::from_str::<RawJsonlMessage>(&line) {
                // Update session ID if we haven't found it yet
                if current_session_id.is_none() {
                    current_session_id = Some(raw_msg.session_id.clone());
                }
                
                let session_id = current_session_id.as_ref().unwrap();
                
                // Only process user and assistant messages
                if raw_msg.message_type != "user" && raw_msg.message_type != "assistant" {
                    continue;
                }
                
                // Search in message content
                if let Ok(content) = self.parse_message_content(&raw_msg.message.content) {
                    match content {
                        MessageContent::Text(text) => {
                            if text.to_lowercase().contains(query_lower) {
                                let snippet = self.create_snippet(&text, query_lower);
                                results.push(SearchResult {
                                    session_id: session_id.clone(),
                                    message_uuid: raw_msg.uuid.clone(),
                                    snippet,
                                    match_type: "content".to_string(),
                                });
                            }
                        }
                        MessageContent::Mixed(blocks) => {
                            for block in blocks {
                                // Search in text blocks (message content)
                                if let Some(text) = &block.text {
                                    if text.to_lowercase().contains(query_lower) {
                                        let snippet = self.create_snippet(text, query_lower);
                                        results.push(SearchResult {
                                            session_id: session_id.clone(),
                                            message_uuid: raw_msg.uuid.clone(),
                                            snippet,
                                            match_type: "content".to_string(),
                                        });
                                    }
                                }
                                
                                // Search in thinking blocks
                                if let Some(thinking) = &block.thinking {
                                    if thinking.to_lowercase().contains(query_lower) {
                                        let snippet = self.create_snippet(thinking, query_lower);
                                        results.push(SearchResult {
                                            session_id: session_id.clone(),
                                            message_uuid: raw_msg.uuid.clone(),
                                            snippet,
                                            match_type: "thinking".to_string(),
                                        });
                                    }
                                }
                                
                                // Search in tool names
                                if let Some(name) = &block.name {
                                    if name.to_lowercase().contains(query_lower) {
                                        results.push(SearchResult {
                                            session_id: session_id.clone(),
                                            message_uuid: raw_msg.uuid.clone(),
                                            snippet: format!("Tool: {}", name),
                                            match_type: "tool_name".to_string(),
                                        });
                                    }
                                }
                                
                                // Search in tool input
                                if let Some(input) = &block.input {
                                    let input_text = serde_json::to_string(input).unwrap_or_default();
                                    if input_text.to_lowercase().contains(query_lower) {
                                        let snippet = self.create_snippet(&input_text, query_lower);
                                        results.push(SearchResult {
                                            session_id: session_id.clone(),
                                            message_uuid: raw_msg.uuid.clone(),
                                            snippet,
                                            match_type: "tool_input".to_string(),
                                        });
                                    }
                                }
                                
                                // Search in tool results (content field)
                                if let Some(content) = &block.content {
                                    if content.to_lowercase().contains(query_lower) {
                                        let snippet = self.create_snippet(content, query_lower);
                                        results.push(SearchResult {
                                            session_id: session_id.clone(),
                                            message_uuid: raw_msg.uuid.clone(),
                                            snippet,
                                            match_type: "tool_result".to_string(),
                                        });
                                    }
                                }
                                
                                // Search in structured tool results
                                if let Some(tool_use_result) = &block.tool_use_result {
                                    let result_text = serde_json::to_string(tool_use_result).unwrap_or_default();
                                    if result_text.to_lowercase().contains(query_lower) {
                                        let snippet = self.create_snippet(&result_text, query_lower);
                                        results.push(SearchResult {
                                            session_id: session_id.clone(),
                                            message_uuid: raw_msg.uuid.clone(),
                                            snippet,
                                            match_type: "tool_structured_result".to_string(),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        Ok(results)
    }
    
    fn extract_session_id_fast(&self, line: &str) -> Option<String> {
        // Fast extraction without full JSON parsing
        if let Some(start) = line.find("\"sessionId\":\"") {
            let start_pos = start + 13; // Length of "\"sessionId\":\""
            if let Some(end) = line[start_pos..].find('"') {
                return Some(line[start_pos..start_pos + end].to_string());
            }
        }
        None
    }

    fn create_snippet(&self, text: &str, query: &str) -> String {
        let text_lower = text.to_lowercase();
        if let Some(byte_pos) = text_lower.find(query) {
            // Convert byte position to character position
            let chars: Vec<char> = text.chars().collect();
            let text_lower_chars: Vec<char> = text_lower.chars().collect();
            
            // Find character position of match
            let mut char_pos = 0;
            let mut current_byte_pos = 0;
            for (i, ch) in text_lower_chars.iter().enumerate() {
                if current_byte_pos == byte_pos {
                    char_pos = i;
                    break;
                }
                current_byte_pos += ch.len_utf8();
            }
            
            // Calculate snippet boundaries in character positions
            let start_char = char_pos.saturating_sub(30);
            let query_char_len = query.chars().count();
            let end_char = (char_pos + query_char_len + 30).min(chars.len());
            
            // Extract snippet using character positions
            let snippet: String = chars[start_char..end_char].iter().collect();
            
            if start_char > 0 && end_char < chars.len() {
                format!("...{}...", snippet)
            } else if start_char > 0 {
                format!("...{}", snippet)
            } else if end_char < chars.len() {
                format!("{}...", snippet)
            } else {
                snippet
            }
        } else {
            text.chars().take(60).collect::<String>() + if text.chars().count() > 60 { "..." } else { "" }
        }
    }

    pub async fn get_session_file_path(&self, session_id: &str) -> Result<String> {
        let file_path = self.find_session_file(session_id).await?;
        Ok(file_path.to_string_lossy().to_string())
    }

}