import{addDaysKey}from'@/lib/tz'
export function packageWeek(date:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(+new Date(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Object.assign(new Error('Choose a valid week date'),{status:400});return addDaysKey(date,-((new Date(date+'T12:00:00Z').getUTCDay()+6)%7))}
