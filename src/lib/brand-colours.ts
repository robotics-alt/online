export interface BrandColours{primary:string;secondary:string;allowPersonalAccents:boolean}
export const DEFAULT_BRAND:BrandColours={primary:'#6557d8',secondary:'#0f8078',allowPersonalAccents:false}
export function contrastColour(hex:string){const c=hex.replace('#','').match(/../g)?.map(v=>parseInt(v,16)/255)||[0,0,0];const l=c.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*l[0]+.7152*l[1]+.0722*l[2]>.179?'#111827':'#ffffff'}
