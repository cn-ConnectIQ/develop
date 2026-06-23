"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type HeatmapData = {
  total_pairs: number;
  total_connections: number;
  connection_rate: number;
  rounds: Array<{
    round: number;
    pair_count: number;
    connection_count: number;
    connection_rate: number;
  }>;
  top_participants: Array<{
    id: string;
    name: string;
    company: string | null;
    connections: number;
  }>;
};

async function fetchHeatmap(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/sn-sessions/heatmap`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as HeatmapData;
}

export function NetworkHeatDisplay({ eventId }: { eventId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["sn-heatmap", eventId],
    queryFn: () => fetchHeatmap(eventId),
    refetchInterval: 15_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1A1A2E] pt-20 text-white/60">
        加载网络热度...
      </div>
    );
  }

  const chartData = data.rounds.map((r) => ({
    name: `R${r.round}`,
    pairs: r.pair_count,
    connections: r.connection_count,
    rate: r.connection_rate,
  }));

  return (
    <div className="flex h-full flex-col bg-[#1A1A2E] px-12 pt-24 text-white">
      <div className="mb-8 text-center">
        <p className="text-[32px] font-bold">🌐 Speed Networking 连接热力</p>
        <p className="mt-2 text-white/50">
          总配对 {data.total_pairs} · 建立连接 {data.total_connections} · 连接率{" "}
          {data.connection_rate}%
        </p>
      </div>

      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-2xl bg-white/5 p-6">
          <p className="mb-4 text-lg font-semibold">各轮配对热度</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke="#ffffff80" />
              <YAxis stroke="#ffffff80" />
              <Tooltip
                contentStyle={{
                  background: "#1A1A2E",
                  border: "1px solid #ffffff20",
                }}
              />
              <Bar dataKey="pairs" name="配对数" fill="#185FA5" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="connections"
                name="建立连接"
                fill="#0F6E56"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-white/5 p-6">
          <p className="mb-4 text-lg font-semibold">活跃参会者 TOP 10</p>
          <div className="space-y-3">
            {data.top_participants.slice(0, 10).map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg bg-white/5 px-4 py-3"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={{
                    backgroundColor:
                      i < 3 ? "#534AB7" : "#ffffff15",
                  }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-xs text-white/50">
                    {p.company ?? "—"}
                  </p>
                </div>
                <span className="text-brand-green">{p.connections} 连接</span>
              </div>
            ))}
            {data.top_participants.length === 0 && (
              <p className="py-8 text-center text-white/40">暂无配对数据</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
