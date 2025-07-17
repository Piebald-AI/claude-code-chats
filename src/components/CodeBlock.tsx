import React, { useEffect, useState, useMemo } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { createHighlighter, type BundledLanguage, bundledLanguages } from "shiki";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  language: string;
  code: string;
  className?: string;
}

const LANGUAGE_MAPPINGS: Record<string, string> = {
  'js': 'jsx',
  'ts': 'tsx', 
  'typescript': 'tsx',
  'javascript': 'jsx',
  'py': 'python',
  'sh': 'bash',
  'shell': 'bash',
  'yml': 'yaml',
  'md': 'markdown',
  'c++': 'cpp',
};

const cssStringToObject = (cssString: string): React.CSSProperties => {
  const styleObject: React.CSSProperties = {};
  
  cssString.split(';').forEach((declaration) => {
    const [property, value] = declaration.split(':').map((s) => s.trim());
    
    if (property && value) {
      let processedProperty: string;
      let processedValue: string | number = value;
      
      if (property.startsWith('--')) {
        processedProperty = property;
        processedValue = value;
      } else {
        processedProperty = property.replace(/-([a-z])/g, (_, letter) =>
          letter.toUpperCase()
        );
        
        if (value.includes('var(')) {
          processedValue = value;
        } else if (value.endsWith('px') && !isNaN(Number(value.slice(0, -2)))) {
          processedValue = Number(value.slice(0, -2));
        } else {
          processedValue = value;
        }
      }
      
      (styleObject as any)[processedProperty] = processedValue;
    }
  });
  
  return styleObject;
};

const highlighter = await createHighlighter({
  themes: ['dark-plus', 'github-light'],
  langs: Object.keys(bundledLanguages) as BundledLanguage[],
});

export const CodeBlock: React.FC<CodeBlockProps> = ({ 
  language, 
  code, 
  className 
}) => {
  const [copied, setCopied] = useState(false);
  const [highlightedContent, setHighlightedContent] = useState<React.ReactElement | null>(null);
  const [preStyle, setPreStyle] = useState<string>('');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const mappedLanguage = useMemo(() => {
    if (!language || language.trim() === '') {
      return 'text';
    }
    return language in LANGUAGE_MAPPINGS
      ? LANGUAGE_MAPPINGS[language]
      : language;
  }, [language]);


  useEffect(() => {
    const highlightCode = () => {
      const validLanguage = mappedLanguage in bundledLanguages
        ? (mappedLanguage as BundledLanguage)
        : ('text' as BundledLanguage);

      let capturedPreStyle = '';
      
      const hast = highlighter.codeToHast(code, {
        lang: validLanguage,
        theme: 'dark-plus',
        transformers: [
          {
            pre: (node) => {
              if (node.properties?.style) {
                capturedPreStyle = node.properties.style as string;
              }
            },
          },
        ],
      });

      const highlighted = toJsxRuntime(hast, {
        Fragment,
        jsx,
        jsxs,
      }) as React.ReactElement;

      setHighlightedContent(highlighted);
      setPreStyle(capturedPreStyle);
    };

    highlightCode();
  }, [code, mappedLanguage]);

  const memoizedStyle = useMemo(() => cssStringToObject(preStyle), [preStyle]);

  return (
    <div className={cn("not-prose relative group", className)}>
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-gray-200 text-sm rounded-t-lg border-b border-gray-700">
        <span className="font-medium">
          {mappedLanguage || 'text'}
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
      <div
        className={cn(
          "shiki font-mono overflow-hidden rounded-b-lg text-sm",
          "leading-normal [counter-increment:a_0] [&_.line]:before:[counter-increment:a] [&_.line]:before:content-[counter(a)]",
          "[&_.line]:before:mr-6 [&_.line]:before:ml-3 [&_.line]:before:inline-block [&_.line]:before:text-right",
          "[&_.line]:before:text-muted-foreground [&_.line]:before:w-4",
          "max-w-full min-w-0 overflow-x-auto bg-background"
        )}
        style={memoizedStyle}
      >
        <div className="overflow-auto p-2 [&_pre]:focus-visible:outline-none [&_pre]:whitespace-pre-wrap [&_pre]:word-break-keep-all [&_pre]:overflow-wrap-anywhere">
          {highlightedContent}
        </div>
      </div>
    </div>
  );
};
