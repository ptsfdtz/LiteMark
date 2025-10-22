// Hook: useMathPreprocess
// 提供 preprocessMathChinese 函数，把中文包裹到数学模式中的 \text{...}
export function useMathPreprocess() {
  const preprocessMathChinese = (input: string): string => {
    if (!input) return input;

    const codeBlocks: string[] = [];
    const inlineCodes: string[] = [];

    const fenced = input.replace(/```[\s\S]*?```/g, (m) => {
      const idx = codeBlocks.length;
      codeBlocks.push(m);
      return `__CODE_BLOCK_${idx}__`;
    });

    const noInline = fenced.replace(/`[^`]*`/g, (m) => {
      const idx = inlineCodes.length;
      inlineCodes.push(m);
      return `__INLINE_CODE_${idx}__`;
    });

    const wrapChineseInMath = (mathContent: string) => {
      let res = "";
      let i = 0;
      while (i < mathContent.length) {
        if (mathContent.startsWith("\\text{", i)) {
          let depth = 0;
          let j = i;
          do {
            if (mathContent[j] === "{") depth++;
            else if (mathContent[j] === "}") depth--;
            j++;
          } while (j < mathContent.length && depth > 0);
          res += mathContent.slice(i, j);
          i = j;
        } else {
          const ch = mathContent.charAt(i);
          if (/[\u4e00-\u9fff]/.test(ch)) {
            let j = i + 1;
            while (
              j < mathContent.length &&
              /[\u4e00-\u9fff]/.test(mathContent.charAt(j))
            )
              j++;
            const run = mathContent.slice(i, j);
            res += `\\text{${run}}`;
            i = j;
          } else {
            res += ch;
            i++;
          }
        }
      }
      return res;
    };

    let out = noInline;

    out = out.replace(/\$\$([\s\S]*?)\$\$/g, (_m, g1) => {
      if (/[\u4e00-\u9fff]/.test(g1)) {
        return `$$${wrapChineseInMath(g1)}$$`;
      }
      return `$$${g1}$$`;
    });

    out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_m, g1) => {
      if (/[\u4e00-\u9fff]/.test(g1)) {
        return `\\[${wrapChineseInMath(g1)}\\]`;
      }
      return `\\[${g1}\\]`;
    });

    out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_m, g1) => {
      if (/[\u4e00-\u9fff]/.test(g1)) {
        return `\\(${wrapChineseInMath(g1)}\\)`;
      }
      return `\\(${g1}\\)`;
    });

    out = out.replace(/\$([^\$\n][^\$]*?)\$/g, (_m, g1) => {
      if (/[\u4e00-\u9fff]/.test(g1)) {
        return `$${wrapChineseInMath(g1)}$`;
      }
      return `$${g1}$`;
    });

    out = out.replace(/__INLINE_CODE_(\d+)__/g, (_m, p1) =>
      inlineCodes[Number(p1)] || ""
    );
    out = out.replace(/__CODE_BLOCK_(\d+)__/g, (_m, p1) =>
      codeBlocks[Number(p1)] || ""
    );

    return out;
  };

  return { preprocessMathChinese };
}

export default useMathPreprocess;
