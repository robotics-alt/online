'use client';
import { uiText } from "@/lib/ui-text";
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
export interface WorkingRule {
    weekday: number;
    startMin: number;
    endMin: number;
}
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const time = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const minutes = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
export default function WorkingHoursEditor({ value, onChange, timezone }: {
    value: WorkingRule[];
    onChange: (items: WorkingRule[]) => void;
    timezone: string;
}) {
    return <div className="working-hours"><p className="text-sm text-muted-foreground">{uiText("Set your weekly working hours in ")}<strong>{uiText(timezone)}</strong>{uiText(". Add more than one period for breaks.")}</p>{uiText([1, 2, 3, 4, 5, 6, 0].map(day => <section className="working-day" key={day}><div><strong>{uiText(days[day])}</strong><Button type="button" variant="ghost" size="sm" onClick={() => onChange([...value, { weekday: day, startMin: 9 * 60, endMin: 17 * 60 }])}><Plus size={15}/>{uiText("Add hours")}</Button></div>{!value.some(item => item.weekday === day) && <p>{uiText("Not available")}</p>}{uiText(value.map((item, index) => item.weekday === day && <div key={index} className="working-time-row"><input aria-label={uiText("{{value1}} start time", { value1: days[day] })} type="time" value={time(item.startMin)} onChange={e => onChange(value.map((old, i) => i === index ? { ...old, startMin: minutes(e.target.value) } : old))}/><span>{uiText("to")}</span><input aria-label={uiText("{{value1}} end time", { value1: days[day] })} type="time" value={time(item.endMin)} onChange={e => onChange(value.map((old, i) => i === index ? { ...old, endMin: minutes(e.target.value) } : old))}/><Button type="button" variant="ghost" size="icon" aria-label={uiText("Remove working period")} onClick={() => onChange(value.filter((_, i) => i !== index))}><X size={16}/></Button></div>))}</section>))}</div>;
}
