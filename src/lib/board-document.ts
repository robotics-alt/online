export interface BoardStroke { id:string;tool:'pen'|'line'|'rect'|'ellipse'|'text';color:string;width:number;points:[number,number][];text?:string }
export interface BoardPage { id:string;name:string;width:number;height:number;background?:string;strokes:BoardStroke[] }
export interface BoardDocument {activePageId:string;pages:BoardPage[]}
export function emptyBoard():BoardDocument{return{activePageId:'page-1',pages:[{id:'page-1',name:'Page 1',width:1000,height:750,strokes:[]}]}}
export function validStroke(value:unknown):value is BoardStroke{
  const stroke=value as BoardStroke
  return Boolean(stroke&&typeof stroke.id==='string'&&stroke.id.length<160&&['pen','line','rect','ellipse','text'].includes(stroke.tool)&&typeof stroke.color==='string'&&/^#[0-9a-fA-F]{3,8}$/.test(stroke.color)&&Number.isFinite(stroke.width)&&stroke.width>0&&stroke.width<=40&&Array.isArray(stroke.points)&&stroke.points.length>0&&stroke.points.length<=10000&&stroke.points.every(point=>Array.isArray(point)&&point.length===2&&point.every(n=>Number.isFinite(n)&&n>=0&&n<=1))&&(!stroke.text||typeof stroke.text==='string'&&stroke.text.length<=1000))
}
