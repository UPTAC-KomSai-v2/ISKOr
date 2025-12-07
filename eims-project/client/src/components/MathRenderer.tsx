import { useEffect, useRef } from 'react';

interface MathRendererProps {
  text: string;
  className?: string;
}

// This component renders text with LaTeX math equations
// It uses KaTeX which should be loaded via CDN in index.html
const MathRenderer = ({ text, className = '' }: MathRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !text) return;

    // Check if KaTeX is available
    const katex = (window as any).katex;
    if (!katex) {
      // KaTeX not loaded, just show the raw text
      containerRef.current.innerHTML = text;
      return;
    }

    try {
      // Process the text to render math
      let processedText = text;

      // Render display math ($$...$$)
      processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
        try {
          return katex.renderToString(math.trim(), {
            displayMode: true,
            throwOnError: false,
          });
        } catch (e) {
          return `<span class="text-red-500">[Math Error: ${math}]</span>`;
        }
      });

      // Render inline math ($...$)
      processedText = processedText.replace(/\$([^\$]+?)\$/g, (_, math) => {
        try {
          return katex.renderToString(math.trim(), {
            displayMode: false,
            throwOnError: false,
          });
        } catch (e) {
          return `<span class="text-red-500">[Math Error: ${math}]</span>`;
        }
      });

      // Render \[...\] display math
      processedText = processedText.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
        try {
          return katex.renderToString(math.trim(), {
            displayMode: true,
            throwOnError: false,
          });
        } catch (e) {
          return `<span class="text-red-500">[Math Error: ${math}]</span>`;
        }
      });

      // Render \(...\) inline math
      processedText = processedText.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
        try {
          return katex.renderToString(math.trim(), {
            displayMode: false,
            throwOnError: false,
          });
        } catch (e) {
          return `<span class="text-red-500">[Math Error: ${math}]</span>`;
        }
      });

      containerRef.current.innerHTML = processedText;
    } catch (error) {
      console.error('Error rendering math:', error);
      containerRef.current.innerHTML = text;
    }
  }, [text]);

  return <div ref={containerRef} className={className} />;
};

export default MathRenderer;
