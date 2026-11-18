const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),https=require('node:https')
const {randomUUID,randomBytes,scryptSync}=require('node:crypto'),{PrismaClient}=require('@prisma/client'),{io}=require('socket.io-client'),sharp=require('sharp'),{jsPDF}=require('jspdf')
process.env.DATABASE_URL||='file:'+path.resolve(__dirname,'../db/custom.db').replaceAll('\\','/')
const db=new PrismaClient(),base=process.env.LEARNING_TEST_URL||'http://127.0.0.1:3300',ca=fs.readFileSync(path.resolve(__dirname,'../.local-https/ca.pem')),tag='learning-test-'+randomUUID(),password=randomUUID(),salt=randomBytes(16).toString('hex'),passwordHash=salt+':'+scryptSync(password,salt,64).toString('hex'),users=[],sockets=[],bookings=[],groups=[],calls=[],conversations=[],assets=[]
let originalSettings,settingsTouched=false
const groupRooms=[]
function request(url,{method='GET',json,cookie,multipart,binary=false}={}){return new Promise((resolve,reject)=>{
 let bytes,contentType
 if(json!==undefined){bytes=Buffer.from(JSON.stringify(json));contentType='application/json'}
 if(multipart){const boundary='Form-'+randomUUID(),chunks=[];for(const [name,value]of Object.entries(multipart)){chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"${value?.bytes?`; filename="${value.name}"`:''}\r\n${value?.bytes?'Content-Type: '+value.type+'\r\n':''}\r\n`));chunks.push(value?.bytes?value.bytes:Buffer.from(String(value)));chunks.push(Buffer.from('\r\n'))}chunks.push(Buffer.from('--'+boundary+'--\r\n'));bytes=Buffer.concat(chunks);contentType='multipart/form-data; boundary='+boundary}
 const target=new URL(url,base),req=(target.protocol==='https:'?https:http).request(target,{method,ca,headers:{...(cookie?{Cookie:cookie}:{}),...(bytes?{'Content-Type':contentType,'Content-Length':bytes.length}:{})}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{const buffer=Buffer.concat(chunks);let data=buffer;if(!binary){try{data=JSON.parse(buffer.toString())}catch{data=buffer.toString()}}resolve({status:res.statusCode,data,cookie:res.headers['set-cookie']?.[0]?.split(';')[0],headers:res.headers})})});req.on('error',reject);req.setTimeout(20000,()=>req.destroy(new Error('Request timeout: '+url)));req.end(bytes)
})}
async function account(role,status='APPROVED'){
 const user=await db.user.create({data:{name:tag+' '+role,email:randomUUID()+'@learning-test.invalid',role,status:'ACTIVE',passwordHash,walletCents:50000,...(role==='TUTOR'?{tutorProfile:{create:{status,languageItems:JSON.stringify([{name:'English',level:'B2 · Upper intermediate'}]),languages:'English'}}}:{})},include:{tutorProfile:true}});users.push(user)
 const login=await request('/api/auth/login',{method:'POST',json:{email:user.email,password}});assert.equal(login.status,200);return{...user,cookie:login.cookie}
}
async function upload(user,scope,scopeId,bytes,type='image/png',token=''){
 const result=await request('/api/media',{method:'POST',cookie:user.cookie,multipart:{scope,scopeId,token,file:{bytes,type,name:type==='application/pdf'?'certificate.pdf':'image.png'}}});assert.equal(result.status,200,JSON.stringify(result.data));assets.push(result.data.asset.id);return result.data.asset
}
async function socket(){const connection=io(process.env.REALTIME_TEST_URL||'http://127.0.0.1:3003',{path:'/',transports:['websocket'],reconnection:false,ca});sockets.push(connection);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Socket connect timeout')),8000);connection.once('connect',()=>{clearTimeout(timer);resolve()});connection.once('connect_error',reject)});return connection}
const ack=(connection,event,data)=>connection.timeout(6000).emitWithAck(event,data)
function once(connection,event){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(event+' timed out')),6000);connection.once(event,data=>{clearTimeout(timer);resolve(data)})})}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(fn){for(let i=0;i<40;i++){if(await fn())return;await sleep(100)}throw new Error('Timed condition did not pass')}
const stroke=id=>({id,tool:'pen',color:'#6557d8',width:3,points:[[.2,.2],[.4,.4]]})
async function run(){
 const teacher=await account('TUTOR'),student=await account('STUDENT'),other=await account('STUDENT'),admin=await account('ADMIN'),draft=await account('TUTOR','DRAFT')
 const picture=await sharp({create:{width:2400,height:1800,channels:3,background:'#6557d8'}}).png().toBuffer()
 const certificate=new jsPDF();certificate.text('Isolated qualification evidence',20,20);const pdf=Buffer.from(certificate.output('arraybuffer'))
 const proof=await upload(draft,'certificate','',pdf,'application/pdf')
 assert.equal((await request(proof.url,{cookie:other.cookie,binary:true})).status,403);assert.equal((await request(proof.url,{cookie:admin.cookie,binary:true})).status,200)
 const subject=await db.subject.findFirst({where:{active:true}});assert(subject,'Seed subjects must be present')
 const profileData={headline:'Qualified mathematics teacher',about:'I create practical, inclusive lessons that help students grow in confidence and understand difficult topics. '.repeat(2),languageItems:[{name:'French',level:'C1 · Advanced'}],subjectIds:[subject.id],experienceItems:[],skillItems:[],action:'submit'}
 assert.equal((await request('/api/tutor/profile',{method:'PUT',cookie:draft.cookie,json:profileData})).status,400)
 assert.equal((await request('/api/tutor/availability',{method:'PUT',cookie:draft.cookie,json:{rules:[{weekday:1,startMin:540,endMin:1020}]}})).status,200)
 const institutional={...profileData,experienceItems:[{title:'Mathematics teacher',years:4,organization:'Test school '+tag,program:'IGCSE'}]}
 assert.equal((await request('/api/tutor/profile',{method:'PUT',cookie:draft.cookie,json:institutional})).status,400)
 institutional.experienceItems[0].certificateId=proof.id
 assert.equal((await request('/api/tutor/profile',{method:'PUT',cookie:draft.cookie,json:institutional})).status,200)
 const applications=await request('/api/admin/applications?status=PENDING',{cookie:admin.cookie});assert(applications.data.applications.find(item=>item.id===draft.tutorProfile.id).experienceItems.includes(proof.id))
 assert.equal((await request('/api/admin/applications',{method:'POST',cookie:admin.cookie,json:{tutorProfileId:draft.tutorProfile.id,action:'approve'}})).status,200)
 const proposed=[{name:'German',level:'B2 · Upper intermediate'}]
 const submission=await request('/api/tutor/profile',{method:'PUT',cookie:draft.cookie,json:{languageItems:proposed}});assert.equal(submission.status,200);assert.equal(submission.data.pendingReview,true)
 assert.equal((await request('/api/tutors/'+draft.tutorProfile.id)).data.tutor.languages,'French')
 const change=(await request('/api/admin/profile-changes',{cookie:admin.cookie})).data.changes.find(item=>item.tutorId===draft.tutorProfile.id);assert(change)
 assert.equal((await request('/api/admin/profile-changes',{method:'POST',cookie:student.cookie,json:{id:change.id,action:'approve'}})).status,403)
 assert.equal((await request('/api/admin/profile-changes',{method:'POST',cookie:admin.cookie,json:{id:change.id,action:'approve'}})).status,200)
 assert.equal((await request('/api/admin/profile-changes',{method:'POST',cookie:admin.cookie,json:{id:change.id,action:'approve'}})).status,409)
 const published=(await request('/api/tutors/'+draft.tutorProfile.id)).data.tutor;assert.equal(published.languages,'German');assert(!published.experienceItems.includes(proof.id))
 const badProof=await request('/api/tutor/profile',{method:'PUT',cookie:teacher.cookie,json:{experienceItems:institutional.experienceItems}});assert.equal(badProof.status,400)
 console.log('Working-hours requirement, structured language/experience lists, certificate ownership and admin-only profile publication passed')
 const conversation=await request('/api/conversations',{method:'POST',cookie:teacher.cookie,json:{userId:student.id}});const conversationId=conversation.data.conversationId;conversations.push(conversationId)
 const text=await request('/api/conversations/'+conversationId,{method:'POST',cookie:teacher.cookie,json:{body:'A message to reply to'}});assert.equal(text.status,200)
 const image=await upload(student,'conversation',conversationId,picture)
 assert.equal(image.mime,'image/webp');const compressed=await request(image.url,{cookie:teacher.cookie,binary:true});assert.equal(compressed.status,200);const metadata=await sharp(compressed.data).metadata();assert(metadata.width<=1600);assert.equal((await request(image.url,{cookie:other.cookie,binary:true})).status,403)
 const imageMessage=await request('/api/conversations/'+conversationId,{method:'POST',cookie:student.cookie,json:{body:'',attachmentUrl:image.url,replyToId:text.data.message.id}});assert.equal(imageMessage.status,200);assert.equal(imageMessage.data.message.replyBody,'A message to reply to');assert.equal(imageMessage.data.message.attachmentType,'image/webp')
 assert.equal((await request('/api/conversations/'+conversationId,{method:'POST',cookie:teacher.cookie,json:{body:'',attachmentUrl:image.url}})).status,400)
 assert.equal((await request('/api/conversations/'+conversationId,{method:'POST',cookie:student.cookie,json:{body:'Invalid reply',replyToId:'not-this-conversation'}})).status,400)
 const reaction=await request('/api/conversations/'+conversationId+'/reactions',{method:'POST',cookie:teacher.cookie,json:{messageId:imageMessage.data.message.id,emoji:'👍'}});assert.equal(reaction.data.message.reactions.length,1)
 assert.equal((await request('/api/conversations/'+conversationId+'/reactions',{method:'POST',cookie:other.cookie,json:{messageId:imageMessage.data.message.id,emoji:'👍'}})).status,404)
 assert.equal((await request('/api/conversations/'+conversationId+'/reactions',{method:'POST',cookie:teacher.cookie,json:{messageId:imageMessage.data.message.id,emoji:'👍'}})).data.message.reactions.length,0)
 await request('/api/presence',{method:'POST',cookie:teacher.cookie});assert((await request('/api/conversations/'+conversationId,{cookie:student.cookie})).data.other.lastSeenAt)
 console.log('Compressed private images, attachment-only messages, replies, reaction toggling and authenticated active status passed')
 const begins=new Date(Date.now()+2*86400000),booking=await db.booking.create({data:{studentId:student.id,tutorId:teacher.id,tutorProfileId:teacher.tutorProfile.id,startUtc:begins,endUtc:new Date(+begins+1800000),durationMin:30,status:'CONFIRMED',isTrial:true,roomId:'test-'+randomUUID(),priceCents:0}});bookings.push(booking.id)
 const started=await request('/api/lesson-calls',{method:'POST',cookie:teacher.cookie,json:{bookingId:booking.id}});assert.equal(started.status,200);const call=started.data.call;calls.push(call.id)
 const teacherToken=(await request(`/api/classroom/${booking.id}/token?callId=${call.id}`,{cookie:teacher.cookie})).data.token,studentToken=(await request(`/api/classroom/${booking.id}/token?callId=${call.id}`,{cookie:student.cookie})).data.token
 const teacherSocket=await socket(),studentSocket=await socket(),first=await ack(teacherSocket,'join_lesson',{token:teacherToken});assert.equal(first.ok,true);assert.equal(first.document.pages.length,1);assert.equal((await ack(studentSocket,'join_lesson',{token:studentToken})).ok,true)
 assert.equal((await ack(studentSocket,'wb_page_add',{})).ok,false)
 const added=await ack(teacherSocket,'wb_page_add',{});assert.equal(added.ok,true);await ack(teacherSocket,'wb_page_switch',{pageId:added.pageId});await ack(teacherSocket,'wb_access',{locked:false})
 const drawn=once(teacherSocket,'wb_stroke');studentSocket.emit('wb_stroke',{pageId:added.pageId,stroke:stroke('second-page')});assert.equal((await drawn).stroke.id,'second-page')
 const pdfImage='data:image/jpeg;base64,'+(await sharp({create:{width:600,height:800,channels:3,background:'#fff'}}).jpeg().toBuffer()).toString('base64'),pdfPage=await ack(teacherSocket,'wb_page_add',{name:'Imported PDF page',background:pdfImage,width:600,height:800});assert.equal(pdfPage.ok,true);await ack(teacherSocket,'wb_page_switch',{pageId:pdfPage.pageId})
 const annotation=once(teacherSocket,'wb_stroke');studentSocket.emit('wb_stroke',{pageId:pdfPage.pageId,stroke:stroke('pdf-annotation')});await annotation
 studentSocket.emit('wb_stroke',{pageId:added.pageId,stroke:stroke('stale-page')});await ack(studentSocket,'wb_access',{locked:false})
 const snapshot=(await ack(teacherSocket,'wb_document_request',{})).document;assert.equal(snapshot.pages.length,3);assert.equal(snapshot.pages.find(page=>page.id===added.pageId).strokes.length,1);assert.equal(snapshot.pages.find(page=>page.id===pdfPage.pageId).strokes.length,1)
 await ack(teacherSocket,'wb_access',{locked:true});studentSocket.emit('wb_clear',{pageId:pdfPage.pageId});await ack(studentSocket,'wb_access',{locked:false});assert.equal((await ack(teacherSocket,'wb_document_request',{})).document.pages.find(page=>page.id===pdfPage.pageId).strokes.length,1)
 const lessonImage=await upload(student,'classroom',call.roomId,picture,'image/png',studentToken),storedImage=await db.mediaAsset.findUnique({where:{id:lessonImage.id}}),incoming=once(teacherSocket,'lesson_chat');studentSocket.emit('lesson_chat',{body:'',clientId:'image-'+randomUUID(),attachmentId:lessonImage.id});assert.equal((await incoming).imageUrl,lessonImage.url)
 assert.equal((await request(lessonImage.url,{cookie:other.cookie,binary:true})).status,410)
 const ended=once(studentSocket,'call_ended'),archive=once(studentSocket,'wb_final_snapshot');assert.equal((await request('/api/lesson-calls/'+call.id,{method:'PATCH',cookie:teacher.cookie,json:{action:'end'}})).status,200);await ended;assert.equal((await archive).pages.length,3)
 await until(async()=>!await db.mediaAsset.findUnique({where:{id:lessonImage.id}}));assert(!fs.existsSync(path.resolve(__dirname,'../.local-uploads',storedImage.storageKey)))
 assert([404,410].includes((await request(lessonImage.url,{cookie:student.cookie,binary:true})).status))
 assert.equal((await request('/api/media',{method:'POST',cookie:student.cookie,multipart:{scope:'classroom',scopeId:call.roomId,token:studentToken,file:{bytes:picture,type:'image/png',name:'after.png'}}})).status,403)
 console.log('Multi-page snapshots, per-page strokes, PDF backgrounds, locked annotations, stale-page protection, lesson images and end-of-call file removal passed')
 const classData={action:'create',title:'Test group class '+tag,description:'A practical small-group lesson for this isolated integration check.',subject:'Mathematics',startUtc:new Date(Date.now()+4*86400000).toISOString(),durationMin:60,minStudents:5,maxStudents:6,priceCents:0}
 assert.equal((await request('/api/group-classes',{method:'POST',cookie:student.cookie,json:classData})).status,403)
 assert.equal((await request('/api/group-classes',{method:'POST',cookie:teacher.cookie,json:{...classData,minStudents:4}})).status,400)
 const groupResult=await request('/api/group-classes',{method:'POST',cookie:teacher.cookie,json:classData});assert.equal(groupResult.status,200,JSON.stringify(groupResult.data));const group=groupResult.data.class;groups.push(group.id);groupRooms.push(group.roomId)
 const members=[student,other,await account('STUDENT'),await account('STUDENT'),await account('STUDENT')]
 for(let i=0;i<4;i++)assert.equal((await request('/api/group-classes',{method:'POST',cookie:members[i].cookie,json:{action:'enroll',groupId:group.id}})).status,200)
 assert.equal((await request('/api/group-classes/'+group.id+'/token',{cookie:teacher.cookie})).status,423)
 assert.equal((await request('/api/group-classes',{method:'POST',cookie:members[4].cookie,json:{action:'enroll',groupId:group.id}})).status,200)
 assert.equal((await request('/api/group-classes',{method:'POST',cookie:student.cookie,json:{action:'enroll',groupId:group.id}})).status,409)
 await db.groupClass.update({where:{id:group.id},data:{startUtc:new Date(Date.now()+5*60000)}})
 const classToken=(await request('/api/group-classes/'+group.id+'/token',{cookie:teacher.cookie})).data.token,groupSocket=await socket();assert.equal((await ack(groupSocket,'join_lesson',{token:classToken})).ok,true)
 const joined=[];for(const member of members){const token=(await request('/api/group-classes/'+group.id+'/token',{cookie:member.cookie})).data.token,connection=await socket();assert.equal((await ack(connection,'join_lesson',{token})).ok,true);joined.push(connection)}
 assert.equal((await ack(groupSocket,'wb_access',{locked:false})).ok,false);assert.equal((await ack(groupSocket,'wb_access',{locked:false,studentId:members[2].id})).ok,true)
 const allowed=once(groupSocket,'wb_stroke');joined[2].emit('wb_stroke',{stroke:stroke('selected-group-student')});await allowed;joined[0].emit('wb_stroke',{stroke:stroke('unselected-group-student')});await ack(joined[0],'wb_access',{locked:false});assert.equal((await ack(groupSocket,'wb_document_request',{})).document.pages[0].strokes.length,1)
 const groupEnd=once(joined[0],'lesson_ended');assert.equal((await request('/api/classrooms/end',{method:'POST',cookie:teacher.cookie,json:{token:classToken}})).status,200);await groupEnd
 const paid=await request('/api/group-classes',{method:'POST',cookie:teacher.cookie,json:{...classData,startUtc:new Date(Date.now()+5*86400000).toISOString(),priceCents:1200}});assert.equal(paid.status,200);groups.push(paid.data.class.id);groupRooms.push(paid.data.class.roomId)
 const balance=(await db.user.findUnique({where:{id:student.id}})).walletCents,paidEnrollment=await request('/api/group-classes',{method:'POST',cookie:student.cookie,json:{action:'enroll',groupId:paid.data.class.id,paymentMethod:'WALLET'}});assert.equal(paidEnrollment.data.enrollment.status,'PENDING');assert.equal((await db.user.findUnique({where:{id:student.id}})).walletCents,balance-1200)
 assert.equal((await request('/api/admin/group-enrollments',{method:'POST',cookie:admin.cookie,json:{id:paidEnrollment.data.enrollment.id,action:'reject'}})).status,200);assert.equal((await db.user.findUnique({where:{id:student.id}})).walletCents,balance)
 assert.equal((await request('/api/admin/group-enrollments',{method:'POST',cookie:admin.cookie,json:{id:paidEnrollment.data.enrollment.id,action:'reject'}})).status,409)
 console.log('Group publishing, five-member opening threshold, multi-student board assignment, classroom end and paid-enrolment rejection refunds passed')
 originalSettings=await db.setting.findUnique({where:{key:'platform'}});settingsTouched=true
 try{
  const settings={enabledLanguages:['en','ar'],defaultLanguage:'ar',enabledCurrencies:['USD','EUR'],defaultCurrency:'EUR',typography:{ar:{font:'Tahoma',size:20},en:{font:'Arial',size:18}}}
  assert.equal((await request('/api/admin/settings',{method:'PUT',cookie:admin.cookie,json:settings})).status,200)
  const publicData=await request('/api/public');assert.equal(publicData.data.settings.defaultLanguage,'ar');assert.equal(publicData.data.settings.typography.ar.size,20)
  assert.equal((await request('/api/me',{method:'PUT',cookie:student.cookie,json:{currency:'GHS'}})).status,400)
  assert.equal((await request('/api/admin/settings',{method:'PUT',cookie:admin.cookie,json:{defaultLanguage:'fr'}})).status,400)
  assert.equal((await request('/api/admin/settings',{method:'PUT',cookie:admin.cookie,json:{typography:{ar:{font:'Tahoma',size:40}}}})).status,400)
  const email=randomUUID()+'@learning-test.invalid',registration=await request('/api/auth/register',{method:'POST',json:{name:tag+' registered',email,password,role:'STUDENT',country:'Iceland',timezone:'Atlantic/Reykjavik',spokenLanguages:[{name:'Arabic',level:'Native / bilingual'},{name:'English',level:'B2 · Upper intermediate'}]}});assert.equal(registration.status,200,JSON.stringify(registration.data));const registered=await db.user.findUnique({where:{email}});users.push(registered);assert.equal(registered.currency,'EUR');assert.equal(registered.language,'ar');assert.equal(registered.timezone,'Atlantic/Reykjavik');assert.equal(JSON.parse(registered.spokenLanguages).length,2)
 }finally{if(originalSettings)await db.setting.upsert({where:{key:'platform'},create:originalSettings,update:{value:originalSettings.value}});else await db.setting.deleteMany({where:{key:'platform'}});settingsTouched=false}
 console.log('Country-based registration timezone, multiple language levels, enabled/default locales, currencies and per-language typography validation passed')
}
run().catch(error=>{console.error(error.stack);process.exitCode=1}).finally(async()=>{
 sockets.forEach(connection=>connection.disconnect())
 if(settingsTouched){if(originalSettings)await db.setting.upsert({where:{key:'platform'},create:originalSettings,update:{value:originalSettings.value}});else await db.setting.deleteMany({where:{key:'platform'}})}
 const ids=users.map(user=>user.id),profileIds=users.filter(user=>user.tutorProfile).map(user=>user.tutorProfile.id)
 const ownedAssets=await db.mediaAsset.findMany({where:{ownerId:{in:ids}}});for(const asset of ownedAssets){const file=path.resolve(__dirname,'../.local-uploads',asset.storageKey);if(file.startsWith(path.resolve(__dirname,'../.local-uploads')+path.sep))fs.rmSync(file,{force:true})}await db.mediaAsset.deleteMany({where:{ownerId:{in:ids}}})
 if(groups.length){const enrollments=await db.groupEnrollment.findMany({where:{groupId:{in:groups}}});await db.payment.deleteMany({where:{refId:{in:enrollments.map(row=>'group:'+row.id)}}});await db.groupClass.deleteMany({where:{id:{in:groups}}})}
 if(bookings.length)await db.booking.deleteMany({where:{id:{in:bookings}}})
 if(conversations.length)await db.conversation.deleteMany({where:{id:{in:conversations}}})
 if(calls.length)await db.setting.deleteMany({where:{key:{in:calls.map(id=>'lesson-call:'+id)}}})
 await db.setting.deleteMany({where:{key:{in:groupRooms.map(room=>'classroom-ended:'+room)}}})
 if(ids.length){await db.tutorProfileChange.deleteMany({where:{userId:{in:ids}}});await db.notification.deleteMany({where:{OR:[{userId:{in:ids}},{body:{contains:tag}}]}});await db.auditLog.deleteMany({where:{actorId:{in:ids}}});await db.ledgerEntry.deleteMany({where:{userId:{in:ids}}});await db.payment.deleteMany({where:{userId:{in:ids}}});await db.session.deleteMany({where:{userId:{in:ids}}});await db.notificationPrefs.deleteMany({where:{userId:{in:ids}}});await db.studentProfile.deleteMany({where:{userId:{in:ids}}});await db.tutorProfile.deleteMany({where:{userId:{in:ids}}});await db.user.deleteMany({where:{id:{in:ids}}})}
 await db.$disconnect();console.log('Isolated learning expansion fixtures and files removed')
})
