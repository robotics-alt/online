import{randomUUID}from'node:crypto'
import type{Server,Socket}from'socket.io'
import{emptyBoard,type BoardDocument,type BoardPage}from'../../src/lib/board-document'
export const boardDocuments=new Map<string,BoardDocument>()
export function getBoard(roomId:string){let document=boardDocuments.get(roomId);if(!document){document=emptyBoard();boardDocuments.set(roomId,document)}return document}
export function currentPage(roomId:string){const document=getBoard(roomId);return document.pages.find(page=>page.id===document.activePageId)!}
export function setCurrentStrokes(roomId:string,strokes:unknown[]){currentPage(roomId).strokes=strokes as BoardPage['strokes']}
export function registerBoardPages(io:Server,socket:Socket,whiteboards:Map<string,unknown[]>){
  const context=()=>{const room=socket.data.lessonRoom as string|undefined,peer=socket.data.peer;return{room,peer,roomId:room?.replace('lesson:','')}}
  socket.on('wb_page_add',(data:{name?:string;width?:number;height?:number;background?:string},ack?:(result:{ok:boolean;error?:string;pageId?:string})=>void)=>{
    const{room,peer,roomId}=context();if(!room||!roomId||peer?.role!=='tutor')return ack?.({ok:false,error:'Only the teacher adds pages or PDF books'})
    const document=getBoard(roomId)
    if(document.pages.length>=100)return ack?.({ok:false,error:'A board can contain up to 100 pages'})
    if(data.background&&(!/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(data.background)||data.background.length>900000))return ack?.({ok:false,error:'The page image is too large or invalid'})
    if(document.pages.reduce((sum,page)=>sum+(page.background?.length||0),0)+(data.background?.length||0)>25*1024*1024)return ack?.({ok:false,error:'This board has reached its PDF image limit. Use a smaller book.'})
    const width=Math.round(Number(data.width)||1000),height=Math.round(Number(data.height)||750)
    if(width<100||height<100||width>3000||height>3000)return ack?.({ok:false,error:'Invalid page dimensions'})
    const page:BoardPage={id:randomUUID(),name:String(data.name||`Page ${document.pages.length+1}`).slice(0,120),width,height,strokes:[],...(data.background?{background:data.background}:{})}
    document.pages.push(page);io.to(room).emit('wb_page_added',page);ack?.({ok:true,pageId:page.id})
  })
  socket.on('wb_page_switch',(data:{pageId:string},ack?:(result:{ok:boolean;error?:string})=>void)=>{
    const{room,peer,roomId}=context();if(!room||!roomId||peer?.role!=='tutor')return ack?.({ok:false,error:'Only the teacher changes the shared page'})
    const document=getBoard(roomId),page=document.pages.find(page=>page.id===data.pageId)
    if(!page)return ack?.({ok:false,error:'Page not found'})
    document.activePageId=page.id;whiteboards.set(roomId,page.strokes);io.to(room).emit('wb_page_switched',{pageId:page.id,strokes:page.strokes});ack?.({ok:true})
  })
  socket.on('wb_document_request',(_data:unknown,ack?:(result:{ok:boolean;document?:BoardDocument})=>void)=>{const{roomId}=context();ack?.(roomId?{ok:true,document:getBoard(roomId)}:{ok:false})})
}
