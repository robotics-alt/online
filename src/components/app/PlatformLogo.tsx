'use client'
import{GraduationCap}from'lucide-react'
import{useApp}from'@/lib/store'
export default function PlatformLogo({size=24}:{size?:number}){const logo=useApp(s=>s.publicData?.settings.logoUrl);return logo?<img src={logo} alt="" style={{width:size,height:size,objectFit:'contain'}}/>:<GraduationCap size={size}/>}
