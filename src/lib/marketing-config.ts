export interface StatisticRule {enabled:boolean;mode:'auto'|'manual';value:number;label:string}
export interface HeroSlide {id:string;active:boolean;title:string;subtitle:string;buttonText:string;destination:'search'|'tutor'|'classes'|'packages'|'games';teacherId?:string;imageId?:string}
export interface MarketingConfig {
  statisticsEnabled:boolean
  statistics:Record<'students'|'tutors'|'lessons'|'countries',StatisticRule>
  slides:HeroSlide[]
  featuredMode:'auto'|'manual'
  featuredTeacherIds:string[]
  featuredTitle:string
  featuredSubtitle:string
  reviewsEnabled:boolean
  reviewsTitle:string
  gamesEnabled:boolean
  gamesTitle:string
  gamesSubtitle:string
  gameIds:string[]
}
export const DEFAULT_MARKETING:MarketingConfig={statisticsEnabled:true,statistics:{students:{enabled:true,mode:'auto',value:0,label:'Students'},tutors:{enabled:true,mode:'auto',value:0,label:'Expert tutors'},lessons:{enabled:true,mode:'auto',value:0,label:'Lessons completed'},countries:{enabled:true,mode:'auto',value:0,label:'Countries'}},slides:[],featuredMode:'auto',featuredTeacherIds:[],featuredTitle:'Featured teachers',featuredSubtitle:'Find the right teacher for your next step.',reviewsEnabled:true,reviewsTitle:'Loved by students and teachers',gamesEnabled:true,gamesTitle:'Learn through play',gamesSubtitle:'Discover learning games to use with your teacher.',gameIds:[]}
export function normalizeMarketing(value:Partial<MarketingConfig>|undefined):MarketingConfig{return{...DEFAULT_MARKETING,...value,statistics:{...DEFAULT_MARKETING.statistics,...value?.statistics}}}
