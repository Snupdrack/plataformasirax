import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

/** Half-doughnut gauge for Trust / Risk scores (0-100). */
export default function ScoreGauge({ value = 0, label, color = "#0f172a", subtitle, testid }) {
  const v = Math.max(0, Math.min(100, value));
  const data = [
    { name: "filled", value: v },
    { name: "rest", value: 100 - v },
  ];
  return (
    <div className="relative h-44" data-testid={testid}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="85%"
            startAngle={180}
            endAngle={0}
            innerRadius={70}
            outerRadius={100}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
            isAnimationActive={true}
          >
            <Cell fill={color} />
            <Cell fill="#e2e8f0" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-2 pointer-events-none">
        <div className="font-display text-5xl font-extrabold tracking-tighter text-slate-950">
          {Math.round(v)}
        </div>
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</div>
        {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
      </div>
    </div>
  );
}
