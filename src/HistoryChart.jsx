import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { db, ensureAnonAuth } from "./lib/firebase";
import {
  collection, onSnapshot, orderBy, query, where, Timestamp,
} from "firebase/firestore";

function fmtTick(ts) {
  const d = new Date(ts);
  return d.toLocaleString("pt-BR", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function fmtTooltip(ts) {
  const d = new Date(ts);
  return d.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryChart() {
  const [rows, setRows] = useState([]);
  const [showSoil, setShowSoil] = useState(true);
  const [showTemp, setShowTemp] = useState(true);

  useEffect(() => {
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const q = query(
      collection(db, "historico"),
      where("createdAt", ">=", Timestamp.fromDate(start)),
      orderBy("createdAt", "asc")
    );

    let unsub = () => {};
    ensureAnonAuth().then(() => {
      unsub = onSnapshot(q, (snap) => {
        const parsed = snap.docs.map((doc) => {
          const it = doc.data();
          const soilRaw = it.soil ?? it.umidade ?? 0;
          const soilPct = soilRaw <= 1 ? Math.round(soilRaw * 100) : Math.round(soilRaw);
          const temp = typeof it.temp === "number"
            ? it.temp
            : (typeof it.temperatura === "number" ? it.temperatura : null);
          const t = it.createdAt?.toDate ? it.createdAt.toDate() : new Date(it.createdAt);
          return { ts: t.getTime(), soilPct, temp };
        });
        setRows(parsed);
      });
    });
    return () => unsub();
  }, []);

  const data = useMemo(() => {
    if (rows.length) return rows;
    // fallback de 7 dias (caso não haja dados)
    const now = Date.now();
    return Array.from({ length: 7 * 6 }, (_, i) => {
      const ts = now - (7 * 24 * 60 - i * 60) * 60 * 1000;
      return { ts, soilPct: 40 + (i % 5) * 3, temp: 22 + (i % 4) };
    });
  }, [rows]);

  const css = getComputedStyle(document.documentElement);
  const colorText  = css.getPropertyValue("--text")?.trim()  || "#e6f0f7";
  const colorMuted = css.getPropertyValue("--muted")?.trim() || "#9bb0bf";
  const colorGreen = css.getPropertyValue("--green")?.trim() || "#22c55e";
  const colorBlue  = css.getPropertyValue("--blue")?.trim()  || "#60a5fa";

  const handleLegendClick = useCallback((e) => {
    if (e?.dataKey === "soilPct") setShowSoil((v) => !v);
    if (e?.dataKey === "temp") setShowTemp((v) => !v);
  }, []);

  return (
    <div className="panel">
      <h2>Histórico dos Últimos 7 Dias</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 24, left: 12, bottom: 16 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={fmtTick}
              tick={{ fill: colorMuted, fontSize: 14 }}
              tickMargin={10}
              interval="preserveStartEnd"
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
              tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
              minTickGap={28}
            />
            <YAxis
              yAxisId="left"
              domain={[0, 100]}
              tick={{ fill: colorMuted, fontSize: 14 }}
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
              tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
              label={{
                value: "Umidade (%)",
                angle: -90,
                position: "insideLeft",
                fill: colorMuted,
                fontSize: 14,
                offset: 10
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: colorMuted, fontSize: 14 }}
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
              tickLine={{ stroke: "rgba(255,255,255,0.12)" }}
              label={{
                value: "Temperatura (°C)",
                angle: 90,
                position: "insideRight",
                fill: colorMuted,
                fontSize: 14,
                offset: 10
              }}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === "soilPct") return [`${value}%`, "Umidade do Solo"];
                if (name === "temp") return [`${value}°C`, "Temperatura"];
                return [value, name];
              }}
              labelFormatter={(ts) => fmtTooltip(ts)}
              contentStyle={{
                background: "#1f2b36",
                border: "1px solid #334454",
                borderRadius: 10,
                color: colorText,
                fontSize: 15
              }}
            />
            <Legend
              verticalAlign="top"
              height={28}
              iconType="line"
              onClick={handleLegendClick}
              wrapperStyle={{ color: colorMuted, fontSize: 14 }}
            />
            {showSoil && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="soilPct"
                name="Umidade do Solo"
                stroke={colorGreen}
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
                stroke={colorBlue}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
