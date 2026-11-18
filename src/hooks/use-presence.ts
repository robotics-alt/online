'use client'
import{useEffect}from'react'
import{api,useApp}from'@/lib/store'
export function usePresence(){const id=useApp(state=>state.user?.id);useEffect(()=>{if(!id)return;const ping=()=>{if(!document.hidden)void api('/api/presence',{method:'POST'}).catch(()=>{})};ping();const timer=setInterval(ping,30000);document.addEventListener('visibilitychange',ping);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',ping)}},[id])}
