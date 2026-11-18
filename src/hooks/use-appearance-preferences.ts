'use client'
import { useEffect } from 'react'
import{useApp}from'@/lib/store'
import{DEFAULT_BRAND,contrastColour}from'@/lib/brand-colours'
export const ACCENTS = { violet: '#6557d8', teal: '#0f8078', blue: '#2563c4', rose: '#bf3768', amber: '#a65d12' } as const
export type Accent = keyof typeof ACCENTS
export function applyAccent(value: string) {
  const accent = value in ACCENTS ? value as Accent : 'violet'
  document.documentElement.style.setProperty('--primary', ACCENTS[accent])
  document.documentElement.style.setProperty('--primary-foreground', '#ffffff')
  document.documentElement.style.setProperty('--ring', ACCENTS[accent])
  document.documentElement.dataset.accent = accent
}
export function useAppearancePreferences() {
  const branding=useApp(s=>s.publicData?.settings.branding)
  useEffect(() => {
    const restore = () => {const brand=branding||DEFAULT_BRAND;let primary=brand.primary;if(brand.allowPersonalAccents){try{const saved=localStorage.getItem('tutorsphere-accent');if(saved&&saved in ACCENTS)primary=ACCENTS[saved as Accent]}catch{}}
      const root=document.documentElement;root.dataset.platformColours='true';root.style.setProperty('--brand-primary',primary);root.style.setProperty('--brand-secondary',brand.secondary);root.style.setProperty('--brand-foreground',contrastColour(primary));for(const key of ['--primary','--ring'])root.style.setProperty(key,primary);root.style.setProperty('--primary-foreground',contrastColour(primary));root.style.setProperty('--secondary',brand.secondary);root.style.setProperty('--secondary-foreground',contrastColour(brand.secondary));root.dataset.accent='platform';if(brand.allowPersonalAccents){try{root.dataset.accent=localStorage.getItem('tutorsphere-accent')||'platform'}catch{}}
    }
    restore(); window.addEventListener('storage', restore); window.addEventListener('appearance-change', restore)
    return () => { window.removeEventListener('storage', restore); window.removeEventListener('appearance-change', restore) }
  }, [branding])
}
