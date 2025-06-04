import React from 'react';

// Standard ANSI colors - simplified and more readable
const ANSI_COLORS = [
  '#000000', '#d16969', '#b5cea8', '#d7ba7d', 
  '#569cd6', '#c586c0', '#9cdcfe', '#d4d4d4',
  '#808080', '#ff6b6b', '#c2e085', '#ffd700',
  '#7cb7ff', '#ff8ae2', '#79eeff', '#ffffff'
] as const;

interface AnsiStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  backgroundColor?: string;
}

interface AnsiSpan {
  text: string;
  style: AnsiStyle;
}

interface AnsiParserProps {
  text: string;
  className?: string;
}

const AnsiParser: React.FC<AnsiParserProps> = ({ text, className = '' }) => {
  const parseAnsi = (input: string): AnsiSpan[] => {
    const spans: AnsiSpan[] = [];
    let currentStyle: AnsiStyle = {};
    let currentText = '';
    let i = 0;

    const pushSpan = () => {
      if (currentText) {
        spans.push({ text: currentText, style: { ...currentStyle } });
        currentText = '';
      }
    };

    while (i < input.length) {
      // Check for ANSI escape sequence
      if (input[i] === '\x1b' && input[i + 1] === '[') {
        pushSpan();
        
        i += 2; // Skip \x1b[
        let code = '';
        
        // Read until 'm'
        while (i < input.length && input[i] !== 'm') {
          code += input[i++];
        }
        i++; // Skip 'm'

        // Apply codes
        const codes = code.split(';').map(Number).filter(n => !isNaN(n));
        
        for (const num of codes) {
          currentStyle = applyAnsiCode(currentStyle, num);
        }
      } else {
        currentText += input[i++];
      }
    }

    pushSpan();
    return spans;
  };

  const applyAnsiCode = (style: AnsiStyle, code: number): AnsiStyle => {
    const newStyle = { ...style };

    switch (code) {
      case 0: // Reset
        return {};
      case 1: // Bold
        newStyle.bold = true;
        break;
      case 3: // Italic
        newStyle.italic = true;
        break;
      case 4: // Underline
        newStyle.underline = true;
        break;
      case 22: // Normal intensity
        delete newStyle.bold;
        break;
      case 23: // Not italic
        delete newStyle.italic;
        break;
      case 24: // Not underlined
        delete newStyle.underline;
        break;
      default:
        // Foreground colors (30-37, 90-97)
        if (code >= 30 && code <= 37) {
          newStyle.color = ANSI_COLORS[code - 30];
        } else if (code >= 90 && code <= 97) {
          newStyle.color = ANSI_COLORS[code - 90 + 8];
        }
        // Background colors (40-47, 100-107)
        else if (code >= 40 && code <= 47) {
          newStyle.backgroundColor = ANSI_COLORS[code - 40];
        } else if (code >= 100 && code <= 107) {
          newStyle.backgroundColor = ANSI_COLORS[code - 100 + 8];
        }
        break;
    }

    return newStyle;
  };

  const getSpanStyle = (style: AnsiStyle): React.CSSProperties => ({
    fontWeight: style.bold ? 'bold' : 'normal',
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: style.underline ? 'underline' : 'none',
    color: style.color,
    backgroundColor: style.backgroundColor,
  });

  const spans = parseAnsi(text);

  return (
    <pre className={`font-mono text-sm leading-relaxed whitespace-pre-wrap ${className}`}>
      {spans.map((span, index) => (
        <span key={index} style={getSpanStyle(span.style)}>
          {span.text}
        </span>
      ))}
    </pre>
  );
};

export default AnsiParser;