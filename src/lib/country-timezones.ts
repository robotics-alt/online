import ct from 'countries-and-timezones'
export const ALL_COUNTRIES = Object.values(ct.getAllCountries()).sort((a,b)=>a.name.localeCompare(b.name))
export const ALL_COUNTRY_NAMES = ALL_COUNTRIES.map(country=>country.name)
export function zonesForCountry(name: string): string[] {
  return ALL_COUNTRIES.find(country=>country.name === name || country.id === name)?.timezones || []
}
export function timezoneForCountry(country: string,deviceZone='UTC') {
  const zones=zonesForCountry(country)
  if(!zones.length)return deviceZone
  const deviceCountry=ct.getCountryForTimezone(deviceZone)
  if(deviceCountry && (deviceCountry.name===country || deviceCountry.id===country))return deviceZone
  return zones[0]
}

export function suggestedCountry(zone:string){return ct.getCountryForTimezone(zone)?.name||''}
