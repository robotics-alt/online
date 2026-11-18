'use client';
import { uiText } from "@/lib/ui-text";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useApp } from '@/lib/store';
export default function TutorRevenueChart({ monthly }: {
    monthly: {
        month: string;
        netCents: number;
        lessons: number;
    }[];
}) {
    const fmt = useApp((state) => state.fmt);
    const total = monthly.reduce((sum, month) => sum + month.netCents, 0);
    return <section className="teacher-revenue-chart"><div><span>{uiText("Earnings overview")}</span><small>{uiText("Recent months")}</small></div><strong>{uiText(fmt(total))}</strong><p>{uiText("Net earnings across the period")}</p><div className="teacher-chart-canvas"><ResponsiveContainer width="100%" height={140}><AreaChart data={monthly} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}><defs><linearGradient id="teacher-earnings-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8775df" stopOpacity={0.22}/><stop offset="100%" stopColor="#8775df" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4"/><XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => fmt(Number(value || 0))} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}/><Area type="monotone" dataKey="netCents" name="Net earnings" stroke="#8775df" strokeWidth={2.5} fill="url(#teacher-earnings-gradient)"/></AreaChart></ResponsiveContainer></div>{monthly.length === 0 && <p>{uiText("No earnings recorded yet.")}</p>}</section>;
}
