export type TextTransform = (
  text: string,
  start: number,
  end: number
) => string;

export interface ToolbarUtils {
  applyBold: TextTransform;
  applyItalic: TextTransform;
  applyHeading: (text: string, start: number, end: number, level: number) => string;
}
