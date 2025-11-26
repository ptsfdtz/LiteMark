export const applyBold = (text: string, start: number, end: number): string => {
  const selectedText = text.slice(start, end) || "";
  return text.slice(0, start) + "**" + selectedText + "**" + text.slice(end);
};

export const applyItalic = (text: string, start: number, end: number): string => {
  const selectedText = text.slice(start, end) || "";
  return text.slice(0, start) + "_" + selectedText + "_" + text.slice(end);
};

export const applyStrikethrough = (text: string, start: number, end: number): string => {
  const selectedText = text.slice(start, end) || "";
  return text.slice(0, start) + "~~" + selectedText + "~~" + text.slice(end);
};

export const applyCode = (text: string, start: number, end: number): string => {
  const selectedText = text.slice(start, end);
  if (selectedText.includes('\n')) {
    return text.slice(0, start) + "\n```\n" + selectedText + "\n```\n" + text.slice(end);
  }
  const defaultText = selectedText || "";
  return text.slice(0, start) + "`" + defaultText + "`" + text.slice(end);
};

export const applyLink = (text: string, start: number, end: number): string => {
  const selectedText = text.slice(start, end) || "";
  return text.slice(0, start) + "[" + selectedText + "](url)" + text.slice(end);
};

export const applyHeading = (text: string, start: number, end: number): string => {
  let lineStart = start;
  while (lineStart > 0 && text[lineStart - 1] !== '\n') {
    lineStart--;
  }
  
  const line = text.slice(lineStart, start);
  const headingMatch = line.match(/^(#+)\s*/);
  let headingPrefix = "# ";
  
  if (headingMatch) {
    const currentLevel = headingMatch[1].length;
    headingPrefix = "#".repeat(Math.min(currentLevel + 1, 6)) + " ";
    const before = text.slice(0, lineStart);
    const lineContent = text.slice(lineStart, end) || "";
    const after = text.slice(end);
    return before + headingPrefix + lineContent.replace(/^\s+/, '') + after;
  }
  
  const before = text.slice(0, lineStart);
  const lineContent = text.slice(lineStart, end) || "";
  const after = text.slice(end);
  return before + headingPrefix + lineContent + after;
};

export const applyQuote = (text: string, start: number, end: number): string => {
  let lineStart = start;
  while (lineStart > 0 && text[lineStart - 1] !== '\n') {
    lineStart--;
  }
  
  const line = text.slice(lineStart, start);
  if (line.startsWith("> ")) {
    const before = text.slice(0, lineStart);
    const lineContent = text.slice(lineStart, end) || "";
    const after = text.slice(end);
    return before + lineContent.replace(/^>\s?/, '') + after;
  }
  
  const before = text.slice(0, lineStart);
  const lineContent = text.slice(lineStart, end) || "";
  const after = text.slice(end);
  return before + "> " + lineContent + after;
};

export const applyUnorderedList = (text: string, start: number, end: number): string => {
  let lineStart = start;
  while (lineStart > 0 && text[lineStart - 1] !== '\n') {
    lineStart--;
  }
  
  const line = text.slice(lineStart, start);
  if (line.startsWith("- ")) {
    const before = text.slice(0, lineStart);
    const lineContent = text.slice(lineStart, end) || "";
    const after = text.slice(end);
    return before + lineContent.replace(/^-\s?/, '') + after;
  }
  
  const before = text.slice(0, lineStart);
  const lineContent = text.slice(lineStart, end) || "";
  const after = text.slice(end);
  return before + "- " + lineContent + after;
};

export const applyOrderedList = (text: string, start: number, end: number): string => {
  let lineStart = start;
  while (lineStart > 0 && text[lineStart - 1] !== '\n') {
    lineStart--;
  }
  
  const line = text.slice(lineStart, start);
  const orderedListMatch = line.match(/^(\d+)\.\s*/);
  
  if (orderedListMatch) {
    const before = text.slice(0, lineStart);
    const lineContent = text.slice(lineStart, end) || "";
    const after = text.slice(end);
    return before + lineContent.replace(/^\d+\.\s?/, '') + after;
  }
  
  const prevLineEnd = lineStart;
  let prevLineStart = lineStart;
  while (prevLineStart > 0 && text[prevLineStart - 1] !== '\n') {
    prevLineStart--;
  }
  
  const prevLine = text.slice(prevLineStart, prevLineEnd);
  const prevOrderedListMatch = prevLine.match(/^(\d+)\.\s*/);
  const number = prevOrderedListMatch ? parseInt(prevOrderedListMatch[1]) + 1 : 1;
  
  const before = text.slice(0, lineStart);
  const lineContent = text.slice(lineStart, end) || "";
  const after = text.slice(end);
  return before + number + ". " + lineContent + after;
};

export const applyTable = (text: string, position: number): string => {
  const table = `\n| 列 | 列 | 列 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n`;
  
  const before = text.slice(0, position);
  const after = text.slice(position);
  
  const needsBeforeNewline = before && !before.endsWith('\n');
  const needsAfterNewline = after && !after.startsWith('\n');
  
  return before + 
    (needsBeforeNewline ? '\n' : '') + 
    table + 
    (needsAfterNewline ? '\n' : '') + 
    after;
};

export const applyImage = (text: string, start: number, end: number): string => {
  const selectedText = text.slice(start, end) || "";
  return text.slice(0, start) + "![" + selectedText + "]()" + text.slice(end);
};