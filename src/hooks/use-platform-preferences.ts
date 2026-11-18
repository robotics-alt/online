'use client'
import { useEffect } from 'react'
import { api, useApp, type PublicData } from '@/lib/store'
export function usePlatformPreferences(){
  const settings=useApp(state=>state.publicData?.settings),language=useApp(state=>state.language),currency=useApp(state=>state.currency),user=useApp(state=>state.user)
  useEffect(()=>{
    if(!settings)return
    const state=useApp.getState()
    let preferredLanguage=state.user?.languagePreferenceSet?state.user.language:settings.defaultLanguage,preferredCurrency=state.user?.currencyPreferenceSet?state.user.currency:settings.defaultCurrency
    if(!state.user){try{preferredLanguage=localStorage.getItem('ts-guest-language-choice')||settings.defaultLanguage;preferredCurrency=localStorage.getItem('ts-guest-currency-choice')||settings.defaultCurrency}catch{preferredLanguage=settings.defaultLanguage;preferredCurrency=settings.defaultCurrency}}
    const lang=settings.enabledLanguages?.includes(preferredLanguage)?preferredLanguage:settings.defaultLanguage || 'en'
    const currency=settings.enabledCurrencies?.includes(preferredCurrency)?preferredCurrency:settings.defaultCurrency
    if(lang!==state.language || currency!==state.currency || state.user&&(state.user.language!==lang||state.user.currency!==currency))useApp.setState({language:lang,currency,...(state.user?{user:{...state.user,language:lang,currency}}:{})})
    const rule=settings.typography?.[lang]
    document.documentElement.style.setProperty('--dashboard-font-size',`${rule?.size || 16}px`)
    document.documentElement.style.setProperty('--platform-font',rule?.font && rule.font!=='system'?`"${rule.font}",system-ui,sans-serif`:'system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif')
  },[settings,language,currency,user])
  useEffect(()=>{
    const refresh=()=>{void api<PublicData>('/api/public').then(data=>useApp.getState().setPublicData(data)).catch(()=>{})}
    const interval=window.setInterval(()=>{if(!document.hidden)refresh()},60000)
    window.addEventListener('platform-settings-updated',refresh)
    return()=>{clearInterval(interval);window.removeEventListener('platform-settings-updated',refresh)}
  },[])
}
