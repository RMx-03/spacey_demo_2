const { parseAIJSONResponse, fixCommonJSONIssues } = require('../utils/jsonParser');

const samples = [
  '{"a":1,"b":2}',
  '```json\n{"a":1,\n"b":2,}\n```',
  '{a: 1, b: 2}',
  '[\n  "one"\n  "two"\n]'
];

for (const s of samples) {
  try {
    const parsed = parseAIJSONResponse(s);
    console.log('OK:', JSON.stringify(parsed));
  } catch (e) {
    console.log('ERR:', e.message);
    try {
      const fixed = fixCommonJSONIssues(s);
      console.log('Fixed:', fixed);
      console.log('Parsed after fix:', JSON.stringify(JSON.parse(fixed)));
    } catch (e2) {
      console.log('Still broken:', e2.message);
    }
  }
}
