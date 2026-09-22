// Character budgets are UTF-16 code units, consistently on both sides.
export const UI_INPUT_CHARS = 24000;
export const UI_INPUT_BYTES = UI_INPUT_CHARS * 3;
export const UI_RECENT_ACTIONS = 4;
export function serializeUIInput(input) {
  const value = { ...input, history: input.history.slice(-UI_RECENT_ACTIONS) };
  const json = JSON.stringify(value);
  if (json.length > UI_INPUT_CHARS) throw Error('UI_REQUEST_LIMIT');
  return json;
}
export function brokerUnavailable(code) {
  return Object.assign(new Error(code), { code, beforeInference: true });
}
