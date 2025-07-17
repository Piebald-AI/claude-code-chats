use crate::types::*;
use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::{AsyncBufReadExt, BufReader};

pub struct ChatService {
    projects_path: PathBuf,
}

impl ChatService {
    pub fn new() -> Self {
        let projects_path = PathBuf::from(r"C:\Users\user\.claude\projects");
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
        let mut entries = fs::read_dir(project_path).await?;

        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_file() {
                let file_path = entry.path();
                if file_path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                    if let Ok(session) = self.parse_session_from_file(&file_path).await {
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
                            // Check if this file contains our session
                            if let Ok(first_line) = self.read_first_line(&file_path).await {
                                if first_line.contains(&format!("\"sessionId\":\"{}\"", session_id)) {
                                    return Ok(file_path);
                                }
                            }
                        }
                    }
                }
            }
        }

        Err(anyhow::anyhow!("Session file not found for ID: {}", session_id))
    }

    async fn read_first_line(&self, file_path: &Path) -> Result<String> {
        let file = fs::File::open(file_path).await?;
        let reader = BufReader::new(file);
        let mut lines = reader.lines();
        
        if let Some(line) = lines.next_line().await? {
            Ok(line)
        } else {
            Err(anyhow::anyhow!("Empty file"))
        }
    }

    async fn parse_session_from_file(&self, file_path: &Path) -> Result<ChatSession> {
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
            // Look up summary for this chat based on the last message UUID
            let summary_title = self.find_summary_for_chat(&last_message_uuid, file_path.parent().unwrap()).await;
            
            let mut session = ChatSession::new_with_summary(session_id, &first_msg, project_path, summary_title);
            session.message_count = message_count;
            session.last_updated = last_updated;
            Ok(session)
        } else {
            Err(anyhow::anyhow!("No valid messages found in file"))
        }
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

    fn should_merge_with_previous(&self, current_msg: &ChatMessage, messages: &[ChatMessage]) -> bool {
        // Only merge assistant messages
        if current_msg.message_type != "assistant" {
            return false;
        }

        // Current message must only contain tool calls (no text content)
        if !self.is_tool_calls_only(current_msg) {
            return false;
        }

        // Must have a previous message
        if let Some(prev_msg) = messages.last() {
            // Previous message must also be an assistant message
            prev_msg.message_type == "assistant"
        } else {
            false
        }
    }

    fn is_tool_calls_only(&self, message: &ChatMessage) -> bool {
        match &message.content {
            MessageContent::Text(_) => false,
            MessageContent::Mixed(blocks) => {
                // Check if all blocks are tool_use blocks (no text blocks)
                blocks.iter().all(|block| block.block_type == "tool_use")
            }
        }
    }

    fn merge_tool_calls_with_previous(&self, current_msg: &ChatMessage, messages: &mut Vec<ChatMessage>) {
        if let Some(prev_msg) = messages.last_mut() {
            // Extract tool calls from current message
            if let MessageContent::Mixed(current_blocks) = &current_msg.content {
                let tool_calls: Vec<ContentBlock> = current_blocks
                    .iter()
                    .filter(|block| block.block_type == "tool_use")
                    .cloned()
                    .collect();

                // Add tool calls to previous message
                match &mut prev_msg.content {
                    MessageContent::Text(text) => {
                        // Convert text to mixed content and add tool calls
                        let mut blocks = vec![ContentBlock {
                            block_type: "text".to_string(),
                            text: Some(text.clone()),
                            name: None,
                            input: None,
                            tool_use_id: None,
                            content: None,
                            tool_use_result: None,
                            thinking: None,
                        }];
                        blocks.extend(tool_calls);
                        prev_msg.content = MessageContent::Mixed(blocks);
                    }
                    MessageContent::Mixed(prev_blocks) => {
                        // Add tool calls to existing mixed content
                        prev_blocks.extend(tool_calls);
                    }
                }
            }
        }
    }

    fn should_merge_tool_results_with_previous(&self, current_msg: &ChatMessage, messages: &[ChatMessage]) -> bool {
        // Only merge user messages
        if current_msg.message_type != "user" {
            return false;
        }

        // Current message must only contain tool results (no text content)
        if !self.is_tool_results_only(current_msg) {
            return false;
        }

        // Must have a previous message
        if let Some(prev_msg) = messages.last() {
            // Previous message must also be a user message
            prev_msg.message_type == "user"
        } else {
            false
        }
    }

    fn is_tool_results_only(&self, message: &ChatMessage) -> bool {
        match &message.content {
            MessageContent::Text(_) => false,
            MessageContent::Mixed(blocks) => {
                // Check if all blocks are tool_result blocks (no text blocks)
                !blocks.is_empty() && blocks.iter().all(|block| block.block_type == "tool_result")
            }
        }
    }

    fn merge_tool_results_with_previous(&self, current_msg: &ChatMessage, messages: &mut Vec<ChatMessage>) {
        if let Some(prev_msg) = messages.last_mut() {
            // Extract tool results from current message
            if let MessageContent::Mixed(current_blocks) = &current_msg.content {
                let tool_results: Vec<ContentBlock> = current_blocks
                    .iter()
                    .filter(|block| block.block_type == "tool_result")
                    .cloned()
                    .collect();

                // Add tool results to previous message
                match &mut prev_msg.content {
                    MessageContent::Text(text) => {
                        // Convert text to mixed content and add tool results
                        let mut blocks = vec![ContentBlock {
                            block_type: "text".to_string(),
                            text: Some(text.clone()),
                            name: None,
                            input: None,
                            tool_use_id: None,
                            content: None,
                            tool_use_result: None,
                            thinking: None,
                        }];
                        blocks.extend(tool_results);
                        prev_msg.content = MessageContent::Mixed(blocks);
                    }
                    MessageContent::Mixed(prev_blocks) => {
                        // Add tool results to existing mixed content
                        prev_blocks.extend(tool_results);
                    }
                }
            }
        }
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
        
        let projects = self.get_all_projects().await?;
        
        for project in projects {
            for session in project.chat_sessions {
                let messages = self.get_chat_messages(&session.id).await?;
                
                for message in messages {
                    // Search in text content
                    let text = message.extract_text();
                    if text.to_lowercase().contains(&query_lower) {
                        let snippet = self.create_snippet(&text, &query_lower);
                        results.push(SearchResult {
                            session_id: session.id.clone(),
                            message_uuid: message.uuid.clone(),
                            snippet,
                            match_type: "content".to_string(),
                        });
                    }
                    
                    // Search in tool names and results
                    if let MessageContent::Mixed(blocks) = &message.content {
                        for block in blocks {
                            if let Some(name) = &block.name {
                                if name.to_lowercase().contains(&query_lower) {
                                    results.push(SearchResult {
                                        session_id: session.id.clone(),
                                        message_uuid: message.uuid.clone(),
                                        snippet: format!("Tool: {}", name),
                                        match_type: "tool_name".to_string(),
                                    });
                                }
                            }
                            
                            // Search in tool input parameters
                            if let Some(input) = &block.input {
                                let input_text = serde_json::to_string(input).unwrap_or_default();
                                if input_text.to_lowercase().contains(&query_lower) {
                                    let snippet = self.create_snippet(&input_text, &query_lower);
                                    results.push(SearchResult {
                                        session_id: session.id.clone(),
                                        message_uuid: message.uuid.clone(),
                                        snippet,
                                        match_type: "tool_input".to_string(),
                                    });
                                }
                            }
                            
                            if let Some(content) = &block.content {
                                if content.to_lowercase().contains(&query_lower) {
                                    let snippet = self.create_snippet(content, &query_lower);
                                    results.push(SearchResult {
                                        session_id: session.id.clone(),
                                        message_uuid: message.uuid.clone(),
                                        snippet,
                                        match_type: "tool_result".to_string(),
                                    });
                                }
                            }
                            
                            // Search in structured tool results
                            if let Some(tool_use_result) = &block.tool_use_result {
                                let result_text = serde_json::to_string(tool_use_result).unwrap_or_default();
                                if result_text.to_lowercase().contains(&query_lower) {
                                    let snippet = self.create_snippet(&result_text, &query_lower);
                                    results.push(SearchResult {
                                        session_id: session.id.clone(),
                                        message_uuid: message.uuid.clone(),
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
        
        Ok(results)
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

    async fn find_summary_for_chat(&self, last_message_uuid: &str, project_dir: &Path) -> Option<String> {
        // Look for summary files in the same directory
        let mut entries = match fs::read_dir(project_dir).await {
            Ok(entries) => entries,
            Err(_) => return None,
        };

        while let Some(entry) = entries.next_entry().await.ok().flatten() {
            if entry.file_type().await.ok()?.is_file() {
                let file_path = entry.path();
                if file_path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                    // Check if this file contains summaries by looking for summary objects
                    if let Some(summary) = self.find_summary_in_file(&file_path, last_message_uuid).await {
                        return Some(summary);
                    }
                }
            }
        }

        None
    }

    async fn find_summary_in_file(&self, file_path: &Path, target_leaf_uuid: &str) -> Option<String> {
        let file = fs::File::open(file_path).await.ok()?;
        let reader = BufReader::new(file);
        let mut lines = reader.lines();

        while let Some(line) = lines.next_line().await.ok()? {
            if line.trim().is_empty() {
                continue;
            }

            // Try to parse the line as JSON to check if it's a summary
            if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&line) {
                // Check if this is a summary object
                if let Some(summary_type) = json_value.get("type").and_then(|v| v.as_str()) {
                    if summary_type == "summary" {
                        // Check if the leafUuid matches our target
                        if let Some(leaf_uuid) = json_value.get("leafUuid").and_then(|v| v.as_str()) {
                            if leaf_uuid == target_leaf_uuid {
                                // Return the summary field
                                if let Some(summary) = json_value.get("summary").and_then(|v| v.as_str()) {
                                    return Some(summary.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }

        None
    }
}