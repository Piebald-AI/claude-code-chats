import React from "react";
import { Highlight, themes } from "prism-react-renderer";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  language: string;
  code: string;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ 
  language, 
  code, 
  className 
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Clean up the language string
  const cleanLanguage = language.toLowerCase().replace(/^\w+$/, (match) => {
    // Map common language aliases
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'sh': 'bash',
      'shell': 'bash',
      'yml': 'yaml',
      'md': 'markdown',
    };
    return languageMap[match] || match;
  });

  return (
    <div className={cn("not-prose relative group", className)}>
      <Highlight
        theme={themes.vsDark}
        code={code.trim()}
        language={cleanLanguage}
      >
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <div className="relative">
            {/* Header with language and copy button */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-gray-200 text-sm rounded-t-lg border-b border-gray-700">
              <span className="font-medium">
                {cleanLanguage || 'text'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-6 w-6 p-0 hover:bg-gray-700 text-gray-400 hover:text-gray-200"
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>

            {/* Code content */}
            <pre
              className={cn(
                className,
                "overflow-x-auto p-4 text-sm rounded-b-lg m-0"
              )}
              style={style}
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })} className="table-row">
                  <span className="table-cell text-right pr-4 text-gray-500 select-none min-w-[3rem]">
                    {i + 1}
                  </span>
                  <span className="table-cell">
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              ))}
            </pre>
          </div>
        )}
      </Highlight>
    </div>
  );
};
