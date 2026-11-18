'use client'
import{type BoardDocument,type BoardStroke}from'./board-document'
export type DrawBoardStroke=(ctx:CanvasRenderingContext2D,stroke:BoardStroke,width:number,height:number)=>void
export async function exportBoard(document:BoardDocument,draw:DrawBoardStroke){
  const{jsPDF}=await import('jspdf'),pdf=new jsPDF({orientation:document.pages[0].width>=document.pages[0].height?'landscape':'portrait',unit:'pt',format:[document.pages[0].width,document.pages[0].height],compress:true})
  for(let index=0;index<document.pages.length;index++){
    const page=document.pages[index],canvas=window.document.createElement('canvas'),scale=1600/Math.max(page.width,page.height)
    canvas.width=Math.round(page.width*scale);canvas.height=Math.round(page.height*scale)
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height)
    if(page.background){const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Could not export a PDF page'));image.src=page.background!});ctx.drawImage(image,0,0,canvas.width,canvas.height)}
    const referenceWidth=1000,referenceHeight=1000*page.height/page.width;ctx.save();ctx.scale(canvas.width/referenceWidth,canvas.height/referenceHeight);for(const stroke of page.strokes)draw(ctx,stroke,referenceWidth,referenceHeight);ctx.restore()
    if(index)pdf.addPage([page.width,page.height],page.width>=page.height?'landscape':'portrait')
    pdf.addImage(canvas.toDataURL('image/jpeg',.88),'JPEG',0,0,page.width,page.height,undefined,'FAST');canvas.width=1;canvas.height=1
  }
  pdf.save('lesson-whiteboard.pdf')
}
