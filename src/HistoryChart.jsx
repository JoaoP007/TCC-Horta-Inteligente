// src/HistoryChart.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { db, ensureAnonAuth } from "./lib/firebase";
import {
  collection, onSnapshot, orderBy, query, where, Timestamp,
} from "firebase/firestore";

function formatTime(ts) {
  const d = ts instanceof Date ? ts : ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function HistoryChart() {
  const [rows, setRows] = useState([]);
  const [showSoil, setShowSoil] = useState(true);
  const [showTemp, setShowTemp] = useState(true);

  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // últimas 24h

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
          const soilRaw = it.soil ?? it.umidade ?? 0;
          const soilPct = soilRaw <= 1 ? Math.round(soilRaw * 100) : Math.round(soilRaw);
          const temp = typeof it.temp === "number" ? it.temp : (typeof it.temperatura === "number" ? it.temperatura : null);
          const t = it.createdAt;
          return { x: formatTime(t), soilPct, temp };
        });
        setRows(parsed);
      });
    });

    return () => unsub();
  }, []);

  // fallback quando não há dados
  const data = useMemo(() => {
    if (rows.length) return rows;
    const now = Date.now();
    return Array.from({ length: 12 }, (_, i) => {
      const t = new Date(now - (11 - i) * 60 * 60 * 1000);
      return { x: formatTime(t), soilPct: 40 + (i % 5) * 4, temp: 22 + (i % 4) };
    });
  }, [rows]);

  // Cores do tema (usando CSS variables)
  const rootStyle = getComputedStyle(document.documentElement);
  const colorText = rootStyle.getPropertyValue("--text")?.trim() || "#e6f0f7";
  const colorMuted = rootStyle.getPropertyValue("--muted")?.trim() || "#9bb0bf";
  const colorGreen = rootStyle.getPropertyValue("--green")?.trim() || "#2ecc71";
  const colorBlue = rootStyle.getPropertyValue("--blue")?.trim() || "#3b82f6";

  const handleLegendClick = useCallback((e) => {
    if (e?.dataKey === "soilPct") setShowSoil((v) => !v);
    if (e?.dataKey === "temp") setShowTemp((v) => !v);
  }, []);

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={data} margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="x"
          tick={{ fill: colorMuted, fontSize: 13 }}
          tickMargin={8}
          axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
          tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
        />
        {/* Y esquerda: Umidade (%) */}
        <YAxis
          yAxisId="left"
          domain={[0, 100]}
          tick={{ fill: colorMuted, fontSize: 13 }}
          axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
          tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
          label={{
            value: "Umidade (%)",
            angle: -90,
            position: "insideLeft",
            fill: colorMuted,
            fontSize: 14,
            offset: 10,
          }}
        />
        {/* Y direita: Temperatura (°C) */}
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: colorMuted, fontSize: 13 }}
          axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
          tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
          label={{
            value: "Temperatura (°C)",
            angle: 90,
            position: "insideRight",
            fill: colorMuted,
            fontSize: 14,
            offset: 10,
          }}
        />
        <Tooltip
          formatter={(value, name) => {
            if (name === "soilPct") return [`${value}%`, "Umidade do Solo"];
            if (name === "temp") return [`${value}°C`, "Temperatura"];
            return [value, name];
          }}
          labelFormatter={(label) => `Horário: ${label}`}
          contentStyle={{
            background: "#1f2b36",
            border: "1px solid #334454",
            borderRadius: 10,
            color: colorText,
            fontSize: 14,
          }}
        />
        <Legend
          verticalAlign="top"
          height={28}
          iconType="line"
          onClick={handleLegendClick}
          wrapperStyle={{ color: colorMuted, fontSize: 13 }}
        />
        {/* Série: Umidade */}
        {showSoil && (
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="soilPct"
            name="Umidade do Solo"
            stroke={colorGreen}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        )}
        {/* Série: Temperatura */}
        {showTemp && (
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="temp"
            name="Temperatura"
            stroke={colorBlue}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
