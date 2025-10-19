import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { db, ensureAnonAuth } from "./lib/firebase";
import {
  collection, onSnapshot, orderBy, query, where, Timestamp,
} from "firebase/firestore";

/** formata "seg, 13 18:00" (sem segundos) */
function fmtTick(ms) {
  const d = new Date(ms);
  const wd = d.toLocaleDateString([], { weekday: "short" }); // seg., ter., ...
  const day = d.toLocaleDateString([], { day: "2-digit" });
  const hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${wd.replace(".", "")}, ${day} ${hm}`;
}
function fmtTooltip(ms) {
  const d = new Date(ms);
  const date = d.toLocaleDateString([], { weekday: "long", day: "2-digit", month: "short" });
  const hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${date} • ${hm}`;
}

export default function HistoryChart() {
  const [rows, setRows] = useState([]);
  const [showSoil, setShowSoil] = useState(true);
  const [showTemp, setShowTemp] = useState(true);

  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // últimas 7d

    const q = query(
      collection(db, "historico"),
      where("createdAt", ">=", Timestamp.fromDate(start)),
      orderBy("createdAt", "asc")
    );

    let unsub = () => {};
    ensureAnonAuth().then(() => {
      unsub = onSnapshot(q, (snap) => {
        const data = snap.docs.map((d) => d.data());
        const parsed = data.map((it) => {
          const ts = it.createdAt?.toDate ? it.createdAt.toDate() : new Date(it.createdAt);
          const ms = ts.getTime();
          const soilRaw = it.soil ?? it.umidade ?? 0;
          const soilPct = soilRaw <= 1 ? Math.round(soilRaw * 100) : Math.round(soilRaw);
          const temp = typeof it.temp === "number"
            ? it.temp
            : (typeof it.temperatura === "number" ? it.temperatura : null);
          return { ts: ms, soilPct, temp };
        });
        setRows(parsed);
      });
    });
    return () => unsub();
  }, []);

  // fallback de demonstração
  const data = useMemo(() => {
    if (rows.length) return rows;
    const now = Date.now();
    // 7 dias com ponto a cada 6h
    return Array.from({ length: 28 }, (_, i) => {
      const ms = now - (27 - i) * 6 * 60 * 60 * 1000;
      return { ts: ms, soilPct: 45 + (i % 5) * 5, temp: 22 + (i % 4) };
    });
  }, [rows]);

  // tema
  const css = getComputedStyle(document.documentElement);
  const cText  = css.getPropertyValue("--text")?.trim()  || "#e6f0f7";
  const cMuted = css.getPropertyValue("--muted")?.trim() || "#9bb0bf";
  const cGreen = css.getPropertyValue("--green")?.trim() || "#2ecc71";
  const cBlue  = css.getPropertyValue("--blue")?.trim()  || "#3b82f6";

  const onLegendClick = useCallback((e) => {
    if (e?.dataKey === "soilPct") setShowSoil(v => !v);
    if (e?.dataKey === "temp") setShowTemp(v => !v);
  }, []);

  return (
    <ResponsiveContainer width="100%" height={420}>
      <LineChart data={data} margin={{ top: 12, right: 24, left: 8, bottom: 12 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="ts"
          tick={{ fill: cMuted, fontSize: 14 }}
          tickMargin={10}
          interval="preserveStartEnd"
          tickFormatter={fmtTick}
          axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
          tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
        />
        <YAxis
          yAxisId="left"
          domain={[0, 100]}
          tick={{ fill: cMuted, fontSize: 14 }}
          axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
          tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
          label={{
            value: "Umidade (%)",
            angle: -90, position: "insideLeft",
            fill: cMuted, fontSize: 15, offset: 10
          }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: cMuted, fontSize: 14 }}
          axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
          tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
          label={{
            value: "Temperatura (°C)",
            angle: 90, position: "insideRight",
            fill: cMuted, fontSize: 15, offset: 10
          }}
        />
        <Tooltip
          labelFormatter={(v) => fmtTooltip(v)}
          formatter={(value, name) => {
            if (name === "soilPct") return [`${value}%`, "Umidade do Solo"];
            if (name === "temp") return [`${value}°C`, "Temperatura"];
            return [value, name];
          }}
          contentStyle={{
            background: "#1f2b36",
            border: "1px solid #334454",
            borderRadius: 12,
            color: cText,
            fontSize: 15,
          }}
        />
        <Legend
          verticalAlign="top"
          height={30}
          iconType="line"
          onClick={onLegendClick}
          wrapperStyle={{ color: cMuted, fontSize: 14 }}
        />
        {showSoil && (
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="soilPct"
            name="Umidade do Solo"
            stroke={cGreen}
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5 }}
          />
        )}
        {showTemp && (
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="temp"
            name="Temperatura"
            stroke={cBlue}
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5 }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
