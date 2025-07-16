/**
 * Processes backspace characters (\b) in text by removing them and the preceding character
 * 
 * @param text - The input text that may contain backspace characters
 * @returns The processed text with backspace characters applied
 */
export function processBackspaces(text: string): string {
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