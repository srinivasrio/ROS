'use client';

import React from 'react';
import {
    LineChart as ReLineChart,
    Line,
    BarChart as ReBarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    Legend,
    AreaChart,
    Area
} from 'recharts';

const COLORS = ['#F97316', '#8B5CF6', '#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#6366F1'];

interface ChartProps {
    data: any[];
    height?: number;
    color?: string;
}

export const LineChart: React.FC<ChartProps> = ({ data, height = 300, color = '#F97316' }) => {
    const [isMounted, setIsMounted] = React.useState(false);
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const safeData = Array.isArray(data) ? data : [];

    if (!isMounted) {
        return (
            <div style={{ height }} className="w-full flex items-center justify-center bg-neutral-50/50 dark:bg-zinc-900/50 rounded-2xl animate-pulse">
                <div className="h-2 w-24 bg-neutral-200 dark:bg-zinc-800 rounded-full" />
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={safeData}>
                    <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                        dataKey="label" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                    />
                    <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickFormatter={(val) => `₹${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`}
                    />
                    <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`₹${(Number(value) || 0).toLocaleString()}`, 'Revenue']}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={color} 
                        fillOpacity={1} 
                        fill="url(#colorValue)" 
                        strokeWidth={3}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export const BarChart: React.FC<ChartProps & { horizontal?: boolean; dataKey?: string }> = ({ 
    data, height = 300, color = '#F97316', horizontal = false, dataKey = "quantity" 
}) => {
    const [isMounted, setIsMounted] = React.useState(false);
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const safeData = Array.isArray(data) ? data : [];

    if (!isMounted) {
        return (
            <div style={{ height }} className="w-full flex items-center justify-center bg-neutral-50/50 dark:bg-zinc-900/50 rounded-2xl animate-pulse">
                <div className="h-2 w-24 bg-neutral-200 dark:bg-zinc-800 rounded-full" />
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height }}>
            <ResponsiveContainer width="100%" height="100%">
                <ReBarChart data={safeData} layout={horizontal ? 'vertical' : 'horizontal'}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    {horizontal ? (
                        <>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                        </>
                    ) : (
                        <>
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                        </>
                    )}
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px' }} />
                    <Bar dataKey={dataKey} fill={color} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} barSize={20} />
                </ReBarChart>
            </ResponsiveContainer>
        </div>
    );
};

export const DonutChart: React.FC<ChartProps> = ({ data, height = 300 }) => {
    const [isMounted, setIsMounted] = React.useState(false);
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const safeData = Array.isArray(data) ? data : [];

    if (!isMounted) {
        return (
            <div style={{ height }} className="w-full flex items-center justify-center bg-neutral-50/50 dark:bg-zinc-900/50 rounded-2xl animate-pulse">
                <div className="h-2 w-24 bg-neutral-200 dark:bg-zinc-800 rounded-full" />
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={safeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {safeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px' }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};
