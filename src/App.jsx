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
  deleteDoc,
} from "firebase/firestore";
import { db, ensureAnonAuth } from "./lib/firebase";

ensureAnonAuth();

// ===================== HOOKS =====================

// Histórico de umidade (coleção "leiturasUmidade") – usado só para valor atual
function useHumidityHistory() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const q = collection(db, "leiturasUmidade");
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs
        .map((docSnap) => docSnap.data())
        .filter(
          (d) =>
            d.createdAt &&
            typeof d.umidade === "number" &&
            typeof d.createdAt.toMillis === "function"
        );

      const sorted = docs
        .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis())
        .slice(-15)
        .map((d) => ({
          dateLabel: d.createdAt
            .toDate()
            .toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            }),
          humidity: d.umidade,
        }));

      setData(sorted);
    });

    return unsub;
  }, []);

  return data;
}

// Umidade atual (último ponto do histórico)
function useCurrentHumidity(history) {
  return history.length ? history[history.length - 1].humidity : 0;
}

// 🔢 MÉDIA DIÁRIA – lê coleção "mediaDiaria"
function useDailyAverageHistory() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const q = collection(db, "mediaDiaria");

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs
        .map((d) => {
          const docData = d.data() || {};

          const rawDate = docData.data || d.id;

          const rawValue =
            docData.media !== undefined && docData.media !== null
              ? docData.media
              : docData.umidade;

          const mediaNumber = Number(rawValue);

          if (!rawDate || Number.isNaN(mediaNumber)) {
            return null;
          }

          return {
            rawDate,
            media: mediaNumber,
          };
        })
        .filter(Boolean);

      const sorted = docs
        .sort((a, b) => String(a.rawDate).localeCompare(String(b.rawDate)))
        .slice(-15)
        .map((d) => {
          const [year, month, day] = String(d.rawDate).split("-");
          const label =
            year && month && day ? `${day}/${month}` : String(d.rawDate);

          return {
            dateLabel: label,
            average: d.media,
          };
        });

      setData(sorted);
    });

    return unsub;
  }, []);

  return data;
}

// Configurações do modo automático
function useAutoSettings() {
  const [settings, setSettings] = useState({
    autoModeEnabled: true,
    minHumidity: 50,
    maxHumidity: 80,
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "configuracao", "geral"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings({
          autoModeEnabled:
            typeof data.autoModeEnabled === "boolean"
              ? data.autoModeEnabled
              : true,
          minHumidity:
            typeof data.minHumidity === "number" ? data.minHumidity : 50,
          maxHumidity:
            typeof data.maxHumidity === "number" ? data.maxHumidity : 80,
        });
      }
    });
    return unsub;
  }, []);

  const save = async (newSet) => {
    await setDoc(
      doc(db, "configuracao", "geral"),
      { ...newSet, updatedAt: new Date() },
      { merge: true }
    );
    setSettings(newSet);
  };

  return { settings, save };
}

// 📅 Agendamento de irrigação (usa UM doc fixo: agendamentos/aspersor1)
function useSchedule() {
  const [schedule, setSchedule] = useState({
    days: [false, false, false, false, false, false, false],
    time: "06:00",
    minutes: 15,
    aspersorId: "aspersor1",
  });

  useEffect(() => {
    const ref = doc(db, "agendamentos", "aspersor1");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const diasBool = labels.map((d) => data.days?.includes(d));

      setSchedule({
        days: diasBool,
        time: data.time || "06:00",
        minutes:
          typeof data.minutes === "number" && !Number.isNaN(data.minutes)
            ? data.minutes
            : 15,
        aspersorId: data.aspersorId || "aspersor1",
      });
    });

    return unsub;
  }, []);

  const save = async (newSched) => {
    const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const diasSelecionados = labels.filter((_, i) => newSched.days[i]);
    if (diasSelecionados.length === 0) {
      alert("Selecione pelo menos um dia da semana!");
      return;
    }

    await setDoc(doc(db, "agendamentos", "aspersor1"), {
      aspersorId: "aspersor1",
      time: newSched.time,         // <- bate com Node-RED (campo "time")
      minutes: newSched.minutes,   // <- bate com Node-RED (campo "minutes")
      days: diasSelecionados,
      createdAt: new Date(),
    });
  };

  return { schedule, save };
}

// Acionar aspersor (status manual)
async function triggerActuator(nextState) {
  try {
    const ref = doc(db, "status", "aspersor1");
    await setDoc(ref, { isOn: nextState, updatedAt: new Date() });
    return { ok: true };
  } catch (e) {
    console.error("Erro ao acionar aspersor:", e);
    return { ok: false };
  }
}

// ===================== COMPONENTES =====================

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

// 💧 Umidade atual
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
        <svg width="190" height="190" viewBox="0 0 200 200">
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

// 🌿 Controle Manual
function ManualControlCard() {
  const [loading, setLoading] = useState(false);
  const [isOn, setIsOn] = useState(false);

  const handleClick = async () => {
    const proximoEstado = !isOn;
    setLoading(true);
    const res = await triggerActuator(proximoEstado);
    if (res.ok) {
      setIsOn(proximoEstado);
    }
    setLoading(false);
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
          {loading
            ? isOn
              ? "Desligando..."
              : "Ligando..."
            : isOn
            ? "Desligar Aspersor"
            : "Ligar Aspersor"}
        </button>
        <p className="text-gray-700">
          Status:{" "}
          <span className="font-medium">{isOn ? "Ativo" : "Inativo"}</span>
        </p>
      </div>
    </Card>
  );
}

// 💦 Automático
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

  const handleMinChange = (value) => {
    const v = Number(value);
    setMinHumidity(v);
    if (v > maxHumidity) {
      setMaxHumidity(v);
    }
  };

  const handleMaxChange = (value) => {
    const v = Number(value);
    setMaxHumidity(v);
    if (v < minHumidity) {
      setMinHumidity(v);
    }
  };

  const save = () => {
    if (maxHumidity < minHumidity) {
      alert("A umidade máxima não pode ser menor que a umidade mínima.");
      return;
    }
    onSave({ autoModeEnabled, minHumidity, maxHumidity });
  };

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
          value={minHumidity}
          onChange={(e) => handleMinChange(e.target.value)}
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
          value={maxHumidity}
          onChange={(e) => handleMaxChange(e.target.value)}
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

// 📅 Agendamento
function ScheduleCard({ schedule, onSave }) {
  const [days, setDays] = useState(schedule.days || []);
  const [start, setStart] = useState(schedule.time || "06:00");
  const [duration, setDuration] = useState(schedule.minutes || 15);

  useEffect(() => {
    setDays(schedule.days || []);
    setStart(schedule.time || "06:00");
    setDuration(schedule.minutes || 15);
  }, [schedule]);

  const toggleDay = (i) =>
    setDays((old) => old.map((v, idx) => (idx === i ? !v : v)));

  // 🔴 Aqui é onde você queria saber “onde alterar”:
  // agora passamos time/minutes pra bater com o Node-RED
  const save = () => onSave({ days, time: start, minutes: duration });

  const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <Card>
      <SectionTitle icon={<span className="text-emerald-600">📅</span>}>
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

// 📋 Lista de agendamentos (histórico)
function ScheduleList() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "agendamentos"), (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(arr.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
    });
    return unsub;
  }, []);

  const excluir = async (id) => {
    if (window.confirm("Excluir este agendamento?")) {
      await deleteDoc(doc(db, "agendamentos", id));
    }
  };

  return (
    <Card>
      <SectionTitle icon={<span className="text-emerald-600">📋</span>}>
        Lista de Agendamentos
      </SectionTitle>
      {items.length === 0 ? (
        <p className="text-gray-500">Nenhum agendamento cadastrado.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((ag) => (
            <li
              key={ag.id}
              className="flex justify-between items-center border rounded-lg p-3"
            >
              <div>
                <strong>{ag.days?.join(", ")}</strong> — {ag.time} ({ag.minutes}{" "}
                min)
              </div>
              <button
                onClick={() => excluir(ag.id)}
                className="bg-red-500 text-white px-2 py-1 rounded"
              >
                Excluir
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// 📈 Histórico (média diária)
function HumidityHistory({ data }) {
  const ticks = useMemo(() => data.map((d) => d.dateLabel), [data]);

  return (
    <Card>
      <SectionTitle icon={<span className="text-emerald-600">📈</span>}>
        Histórico de Umidade (média diária)
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
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#475569" }} />
            <Tooltip formatter={(v) => [`${v}%`, "Média diária"]} />
            <Line
              type="monotone"
              dataKey="average"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ===================== APP PRINCIPAL =====================
export default function App() {
  const history = useHumidityHistory();
  const currentHum = useCurrentHumidity(history);
  const dailyAverageHistory = useDailyAverageHistory();
  const { settings, save: saveAuto } = useAutoSettings();
  const { schedule, save: saveSchedule } = useSchedule();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-7 py-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xl">
            🌿
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">
              Horta Inteligente
            </h1>
            <p className="text-gray-500 -mt-0.5">
              Sistema de Monitoramento e Irrigação
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 grid gap-6">
        {/* Linha 1 – Umidade, Manual e Automático */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <HumidityCard value={currentHum} />
          <ManualControlCard />
          <AutoIrrigationCard settings={settings} onSave={saveAuto} />
        </div>

        {/* Linha 2 – Programação e Histórico (média diária) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ScheduleCard schedule={schedule} onSave={saveSchedule} />
          <HumidityHistory data={dailyAverageHistory} />
        </div>

        {/* Linha 3 – Lista de agendamentos */}
        <ScheduleList />
      </main>
    </div>
  );
}
