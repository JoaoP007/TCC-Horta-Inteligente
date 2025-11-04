import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db, ensureAnonAuth } from "./lib/firebase";

// 🔐 Garante autenticação anônima automática (usa função do firebase.js)
ensureAnonAuth();


/**
 * HORTA INTELIGENTE – DASHBOARD (COM FIRESTORE REAL)
 * --------------------------------------------------
 * ➤ Funciona com as coleções e regras fornecidas.
 * ➤ Usa autenticação anônima para permitir leituras e escritas.
 * ➤ Coleta: configuracao, agendamentos, historico, status.
 */

// =============== FIRESTORE HOOKS ===============
function useHumidityHistory() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const q = collection(db, "historico");
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => doc.data());
      const sorted = docs
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .slice(-15)
        .map((d) => ({
          dateLabel: new Date(d.createdAt).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          }),
          humidity: d.umidade ?? 0,
        }));
      setData(sorted);
    });
    return unsub;
  }, []);

  return data;
}

function useCurrentHumidity(history) {
  return history.length ? history[history.length - 1].humidity : 0;
}

function useAutoSettings() {
  const [settings, setSettings] = useState({
    autoModeEnabled: true,
    minHumidity: 50,
    maxHumidity: 80,
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "configuracao", "geral"), (snap) => {
      if (snap.exists()) setSettings(snap.data());
    });
    return unsub;
  }, []);

  const save = async (newSet) => {
    await setDoc(
      doc(db, "configuracao", "geral"),
      {
        ...newSet,
        updatedAt: new Date(),
      },
      { merge: true }
    );
    setSettings(newSet);
  };

  return { settings, save };
}

function useSchedule() {
  const [schedule, setSchedule] = useState({
    days: [],
    time: "06:00",
    minutes: 15,
    aspersorId: "aspersor1",
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "agendamentos"), (snap) => {
      const docs = snap.docs.map((d) => d.data());
      if (docs[0]) setSchedule(docs[0]);
    });
    return unsub;
  }, []);

  const save = async (newSched) => {
    await setDoc(doc(db, "agendamentos", `prog-${Date.now()}`), {
      aspersorId: "aspersor1",
      time: newSched.start,
      minutes: newSched.duration,
      days: newSched.days,
      createdAt: new Date(),
    });
  };

  return { schedule, save };
}

async function triggerActuator() {
  try {
    const ref = doc(db, "status", "aspersor1");
    await setDoc(ref, {
      isOn: true,
      updatedAt: new Date(),
    });
    return { ok: true };
  } catch (e) {
    console.error("Erro ao acionar aspersor:", e);
    return { ok: false };
  }
}

// =============== COMPONENTES VISUAIS ===============
const Card = ({ children }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
    {children}
  </div>
);

const SectionTitle = ({ icon, children, subtitle }) => (
  <div className="mb-4">
    <div className="flex items-center gap-2 text-gray-900">
      {icon}
      <h2 className="text-2xl font-semibold">{children}</h2>
    </div>
    {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
  </div>
);

function HumidityCard({ value }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const circumference = 2 * Math.PI * 80;
  const stroke = (pct / 100) * circumference;

  return (
    <Card>
      <SectionTitle
        icon={<span className="text-emerald-600">💧</span>}
        subtitle="Leitura atual do sensor"
      >
        Umidade do Solo
      </SectionTitle>

      <div className="flex items-center justify-center py-4">
        <svg
          width="190"
          height="190"
          viewBox="0 0 200 200"
          className="select-none"
        >
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke="#eef2f7"
            strokeWidth="16"
          />
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke="#10b981"
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${stroke} ${circumference}`}
            transform="rotate(-90 100 100)"
          />
          <text
            x="100"
            y="100"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="44"
            fill="#111827"
            fontWeight="700"
          >
            {pct}%
          </text>
          <text
            x="100"
            y="130"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="16"
            fill="#64748b"
          >
            {pct >= 70 ? "Úmido" : pct >= 40 ? "Adequado" : "Seco"}
          </text>
        </svg>
      </div>
    </Card>
  );
}

function ManualControlCard() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Inativo");

  const handleClick = async () => {
    try {
      setLoading(true);
      const res = await triggerActuator();
      if (res.ok) setStatus((s) => (s === "Inativo" ? "Ativo" : "Inativo"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <SectionTitle icon={<span className="text-emerald-600">🌱</span>}>
        Controle Manual
      </SectionTitle>
      <p className="text-gray-600 mb-6">Ative o aspersor manualmente</p>

      <div className="flex flex-col items-center gap-4">
        <div className="w-28 h-28 rounded-full bg-emerald-50 flex items-center justify-center">
          <span className="text-4xl text-emerald-700">🌿</span>
        </div>

        <button
          onClick={handleClick}
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-60"
        >
          {loading ? "Acionando..." : "Ligar Aspersor 1"}
        </button>

        <p className="text-gray-700">
          Status: <span className="font-medium">{status}</span>
        </p>
      </div>
    </Card>
  );
}

function AutoIrrigationCard({ settings, onSave }) {
  const [autoModeEnabled, setAutoModeEnabled] = useState(
    settings.autoModeEnabled
  );
  const [minHumidity, setMinHumidity] = useState(settings.minHumidity);
  const [maxHumidity, setMaxHumidity] = useState(settings.maxHumidity);

  useEffect(() => {
    setAutoModeEnabled(settings.autoModeEnabled);
    setMinHumidity(settings.minHumidity);
    setMaxHumidity(settings.maxHumidity);
  }, [settings]);

  const save = () =>
    onSave({ autoModeEnabled, minHumidity, maxHumidity });

  return (
    <Card>
      <SectionTitle icon={<span className="text-emerald-600">💦</span>}>
        Irrigação Automática
      </SectionTitle>
      <p className="text-gray-600 mb-4">Configure os níveis de umidade</p>

      <div className="flex items-center justify-between mb-5">
        <span className="text-gray-800 font-medium">Modo Automático</span>
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only"
            checked={autoModeEnabled}
            onChange={(e) => setAutoModeEnabled(e.target.checked)}
          />
          <span
            className={`w-11 h-6 rounded-full transition-colors ${
              autoModeEnabled ? "bg-emerald-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`block w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                autoModeEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </span>
        </label>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2 text-gray-800">
          <span>Umidade Mínima</span>
          <span className="font-semibold">{minHumidity}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={90}
          step={1}
          value={minHumidity}
          onChange={(e) => setMinHumidity(Number(e.target.value))}
          className="w-full accent-emerald-600"
        />
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2 text-gray-800">
          <span>Umidade Máxima</span>
          <span className="font-semibold">{maxHumidity}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          step={1}
          value={maxHumidity}
          onChange={(e) => setMaxHumidity(Number(e.target.value))}
          className="w-full accent-emerald-600"
        />
      </div>

      <button
        onClick={save}
        className="w-full rounded-xl py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
      >
        Salvar Configurações
      </button>
    </Card>
  );
}

function ScheduleCard({ schedule, onSave }) {
  const [days, setDays] = useState(schedule.days || []);
  const [start, setStart] = useState(schedule.time || "06:00");
  const [duration, setDuration] = useState(schedule.minutes || 15);

  const toggleDay = (idx) =>
    setDays((old) => old.map((v, i) => (i === idx ? !v : v)));
  const save = () => onSave({ days, start, duration });

  const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <Card>
      <SectionTitle
        icon={<span className="text-emerald-600">📅</span>}
        subtitle="Defina horários e duração"
      >
        Irrigação Programada
      </SectionTitle>

      <div className="mb-5">
        <p className="text-gray-800 font-medium mb-2">Dias da Semana</p>
        <div className="flex flex-wrap gap-3">
          {labels.map((lb, i) => (
            <button
              key={lb}
              onClick={() => toggleDay(i)}
              className={`px-3 py-2 rounded-full border text-sm ${
                days[i]
                  ? "bg-emerald-50 border-emerald-600 text-emerald-700"
                  : "bg-white border-gray-300 text-gray-700"
              }`}
            >
              {days[i] ? "✅" : "⭕"} {lb}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-gray-800 font-medium mb-2">Horário de Início</p>
        <input
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="w-full rounded-xl border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
        />
      </div>

      <div className="mb-2">
        <p className="text-gray-800 font-medium mb-2">Duração (minutos)</p>
        <input
          type="number"
          min={1}
          step={1}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full rounded-xl border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
        />
      </div>

      <button
        onClick={save}
        className="mt-4 w-full rounded-xl py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
      >
        Salvar Programação
      </button>
    </Card>
  );
}

function HumidityHistory({ data }) {
  const ticks = useMemo(() => data.map((d) => d.dateLabel), [data]);

  return (
    <Card>
      <SectionTitle
        icon={<span className="text-emerald-600">📈</span>}
        subtitle="Últimos 15 dias"
      >
        Histórico de Umidade
      </SectionTitle>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis
              dataKey="dateLabel"
              ticks={ticks}
              interval={0}
              tick={{ fontSize: 12, fill: "#475569" }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: "#475569" }}
              tickCount={6}
            />
            <Tooltip
              formatter={(v) => [`${v}%`, "Umidade"]}
              labelFormatter={(l) => `Data: ${l}`}
            />
            <Line
              type="monotone"
              dataKey="humidity"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// =============== APP ===============
export default function App() {
  const history = useHumidityHistory();
  const currentHum = useCurrentHumidity(history);
  const { settings, save: saveAuto } = useAutoSettings();
  const { schedule, save: saveSchedule } = useSchedule();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xl">
            🌿
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Horta Inteligente
            </h1>
            <p className="text-gray-500 -mt-0.5">
              Sistema de Monitoramento e Irrigação
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <HumidityCard value={currentHum} />
          <ManualControlCard />
          <AutoIrrigationCard settings={settings} onSave={saveAuto} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ScheduleCard schedule={schedule} onSave={saveSchedule} />
          <HumidityHistory data={history} />
        </div>
      </main>
    </div>
  );
}
