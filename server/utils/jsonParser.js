/**
 * Attempt to fix common JSON formatting issues in LLM outputs
 */
function fixCommonJSONIssues(jsonStr) {
  if (typeof jsonStr !== 'string') return jsonStr;

  // Remove markdown code fences
  jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*$/g, '');

  // Remove single-line comments
  jsonStr = jsonStr.replace(/\/\/.*$/gm, '');

  // Remove multi-line comments
  jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, '');

  // Fix unquoted property names
  jsonStr = jsonStr.replace(/([,{]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  // Convert single quotes to double quotes for values
  jsonStr = jsonStr.replace(/:\s*'([^']*?)'/g, ': "$1"');

  // Remove trailing commas
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

  // Add missing commas between adjacent strings/objects/arrays across newlines
  jsonStr = jsonStr.replace(/"\s*\n\s*"/g, '",\n"');
  jsonStr = jsonStr.replace(/}\s*\n\s*{/g, '},\n{');
  jsonStr = jsonStr.replace(/]\s*\n\s*\[/g, '],\n[');

  // Remove any trailing commas again just in case
  jsonStr = jsonStr.replace(/,(\s*})/g, '$1');
  jsonStr = jsonStr.replace(/,(\s*])/g, '$1');

  // Balance braces/brackets if off by a small margin
  const openBraces = (jsonStr.match(/{/g) || []).length;
  const closeBraces = (jsonStr.match(/}/g) || []).length;
  const openBrackets = (jsonStr.match(/\[/g) || []).length;
  const closeBrackets = (jsonStr.match(/]/g) || []).length;
  if (openBraces > closeBraces) jsonStr += '}'.repeat(openBraces - closeBraces);
  if (openBrackets > closeBrackets) jsonStr += ']'.repeat(openBrackets - closeBrackets);

  return jsonStr.trim();
}

/**
 * Robustly parse JSON that may be embedded or slightly malformed by LLMs
 */
function parseAIJSONResponse(response) {
  if (typeof response !== 'string') {
    try {
      return JSON.parse(String(response));
    } catch (_) {
      throw new Error('Response is not a valid JSON string');
    }
  }

  try {
    return JSON.parse(response);
  } catch (_) {
    // Helper: balanced extraction for objects/arrays
    const extractBalanced = (text, openChar, closeChar) => {
      const start = text.indexOf(openChar);
      if (start === -1) return null;
      let depth = 0;
      for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (ch === openChar) depth++;
        else if (ch === closeChar) depth--;
        if (depth === 0) {
          return text.slice(start, i + 1);
        }
      }
      return null;
    };

    // Try code fence extraction
    const fence = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fence) {
      const cleaned = fixCommonJSONIssues(fence[1].trim());
      try { return JSON.parse(cleaned); } catch (_) {}
    }

    // Try object extraction
    let objStr = extractBalanced(response, '{', '}');
    if (!objStr) {
      const greedyObj = response.match(/\{[\s\S]*\}/);
      if (greedyObj) objStr = greedyObj[0];
    }
    if (objStr) {
      const cleaned = fixCommonJSONIssues(objStr);
      try { return JSON.parse(cleaned); } catch (_) {}
    }

    // Try array extraction
    let arrStr = extractBalanced(response, '[', ']');
    if (!arrStr) {
      const greedyArr = response.match(/\[[\s\S]*\]/);
      if (greedyArr) arrStr = greedyArr[0];
    }
    if (arrStr) {
      const cleaned = fixCommonJSONIssues(arrStr);
      try { return JSON.parse(cleaned); } catch (_) {}
    }

    throw new Error('No valid JSON found in AI response');
  }
}

module.exports = {
  fixCommonJSONIssues,
  parseAIJSONResponse,
};
