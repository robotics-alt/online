// An account inherits the current platform defaults until a personal choice is saved.
export const preferenceKey=(userId:string,kind:'language'|'currency')=>`user-${kind}-preference:${userId}`
export function effectivePreference(saved:string|undefined,enabled:string[],fallback:string){return saved&&enabled.includes(saved)?saved:fallback}
