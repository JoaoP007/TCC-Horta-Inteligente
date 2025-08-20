import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { Cloud, Thermometer, Droplets, Zap, CircleSlash, Power, Leaf } from 'lucide-react';

// Global Firebase variables (these would be provided by the Canvas environment)

// GARANTA que as linhas de configuração são estas:
const firebaseConfigJson = import.meta.env.VITE_FIREBASE_CONFIG || '{}';
const appId = import.meta.env.VITE_APP_ID || 'default-smart-garden';
const initialAuthToken = null; // Não usamos isto no deploy

const firebaseConfig = JSON.parse(firebaseConfigJson);

// Initialize Firebase
let app;
let auth;
let db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (e) {
    console.error("Firebase initialization error:", e);
    // Fallback for environments where config might be missing during development
    if (!app && Object.keys(firebaseConfig).length === 0) {
        console.warn("Firebase config is empty. App will run with limited functionality.");
    }
}

// Firestore paths
const SENSORS_PATH_TEMPLATE = "artifacts/{appId}/public/data/smartGarden/sensors";
const VALVES_PATH_TEMPLATE = "artifacts/{appId}/public/data/smartGarden/valves";

const getSensorsPath = () => SENSORS_PATH_TEMPLATE.replace("{appId}", appId);
const getValvesPath = () => VALVES_PATH_TEMPLATE.replace("{appId}", appId);


// Main App Component
function App() {
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [sensorData, setSensorData] = useState({
        soilMoisture: 0,
        temperature: 0,
        humidity: 0,
        lightLevel: 0,
    });
    const [valveStates, setValveStates] = useState({
        valve1: false,
        valve2: false,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showMockDataInfo, setShowMockDataInfo] = useState(true);

    // Firebase Authentication
    useEffect(() => {
        if (!auth) {
            console.warn("Auth service not available.");
            setIsAuthReady(true); // Proceed without auth if not available
            setIsLoading(false);
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                setIsAuthReady(true);
            } else {
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (authError) {
                    console.error("Error signing in:", authError);
                    setError("Falha na autenticação. Funcionalidade limitada.");
                    setIsAuthReady(true); // Still proceed to show UI with error
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // Initialize/Ensure Firestore documents exist
    const ensureFirestoreData = useCallback(async () => {
        if (!db || !isAuthReady || !userId) return;

        const sensorsDocRef = doc(db, getSensorsPath());
        const valvesDocRef = doc(db, getValvesPath());

        try {
            let sensorsDocSnap = await getDoc(sensorsDocRef);
            if (!sensorsDocSnap.exists()) {
                await setDoc(sensorsDocRef, {
                    soilMoisture: 50, // Initial mock data
                    temperature: 22,
                    humidity: 60,
                    lightLevel: 700, // lux
                    timestamp: new Date().toISOString(),
                });
                console.log("Mock sensor data initialized.");
            }

            let valvesDocSnap = await getDoc(valvesDocRef);
            if (!valvesDocSnap.exists()) {
                await setDoc(valvesDocRef, {
                    valve1: false,
                    valve2: false,
                    lastUpdatedBy: userId,
                    timestamp: new Date().toISOString(),
                });
                console.log("Valve states initialized.");
            }
        } catch (e) {
            console.error("Error ensuring Firestore data:", e);
            setError("Erro ao inicializar dados no Firestore.");
        }
    }, [isAuthReady, userId]);


    // Firestore Data Subscriptions
    useEffect(() => {
        if (!db || !isAuthReady || !userId) {
            if (isAuthReady) setIsLoading(false); // If auth is ready but no db/user, stop loading
            return;
        }
        
        ensureFirestoreData().then(() => {
            const sensorsDocRef = doc(db, getSensorsPath());
            const valvesDocRef = doc(db, getValvesPath());

            const unsubSensors = onSnapshot(sensorsDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    setSensorData(docSnap.data());
                    setError(null);
                } else {
                    console.warn("Sensor data document does not exist.");
                    setSensorData({ soilMoisture: 0, temperature: 0, humidity: 0, lightLevel: 0 });
                }
                setIsLoading(false);
            }, (err) => {
                console.error("Error fetching sensor data:", err);
                setError("Erro ao buscar dados dos sensores.");
                setIsLoading(false);
            });

            const unsubValves = onSnapshot(valvesDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    setValveStates(docSnap.data());
                } else {
                    console.warn("Valve states document does not exist.");
                    setValveStates({ valve1: false, valve2: false });
                }
            }, (err) => {
                console.error("Error fetching valve states:", err);
                setError("Erro ao buscar estados das válvulas.");
            });
            
            return () => {
                unsubSensors();
                unsubValves();
            };
        });

    }, [isAuthReady, userId, ensureFirestoreData]);

    const handleValveToggle = async (valveId) => {
        if (!db || !userId) {
            setError("Firestore não está pronto ou usuário não autenticado.");
            return;
        }
        const valvesDocRef = doc(db, getValvesPath());
        const newValveState = !valveStates[valveId];
        try {
            await updateDoc(valvesDocRef, {
                [valveId]: newValveState,
                lastUpdatedBy: userId,
                timestamp: new Date().toISOString(),
            });
        } catch (e) {
            console.error("Error toggling valve:", e);
            setError("Erro ao atualizar estado da válvula.");
        }
    };
    
    // Function to update mock sensor data (for demo purposes)
    const updateMockSensorData = async () => {
        if (!db) return;
        const sensorsDocRef = doc(db, getSensorsPath());
        const newMockData = {
            soilMoisture: Math.floor(Math.random() * 101),
            temperature: Math.floor(Math.random() * 15) + 15, // 15-30 C
            humidity: Math.floor(Math.random() * 51) + 40,    // 40-90%
            lightLevel: Math.floor(Math.random() * 801) + 200, // 200-1000 lux
            timestamp: new Date().toISOString(),
        };
        try {
            await setDoc(sensorsDocRef, newMockData);
            console.log("Mock sensor data updated:", newMockData);
        } catch (e) {
            console.error("Error updating mock sensor data:", e);
        }
    };


    if (!isAuthReady || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-green-500"></div>
                <p className="ml-4 text-xl">Carregando Horta Inteligente...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-800 text-white p-4 sm:p-8 font-sans">
            <header className="mb-8 text-center">
                <h1 className="text-4xl sm:text-5xl font-bold text-green-400 flex items-center justify-center">
                    <Leaf size={48} className="mr-3 text-green-500" />
                    Painel da Horta Inteligente
                </h1>
                {userId && <p className="text-xs text-gray-400 mt-1">Conectado como: {userId.substring(0,10)}...</p>}
            </header>

            {error && (
                <div className="bg-red-700 border border-red-900 text-white px-4 py-3 rounded-lg relative mb-6 shadow-lg" role="alert">
                    <strong className="font-bold">Erro: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}
            
            {showMockDataInfo && (
                 <div className="bg-blue-600 border border-blue-800 text-white px-4 py-3 rounded-lg relative mb-6 shadow-lg">
                    <strong className="font-bold">Informação:</strong>
                    <p className="text-sm">Esta interface está usando dados simulados. Em um sistema real, um ESP32 enviaria dados dos sensores e receberia comandos para as válvulas.</p>
                    <p className="text-sm mt-1">As leituras dos sensores são atualizadas automaticamente. Você pode clicar em "Atualizar Dados Mock" para gerar novos valores aleatórios.</p>
                    <button 
                        onClick={() => setShowMockDataInfo(false)} 
                        className="absolute top-0 bottom-0 right-0 px-3 py-2 text-blue-100 hover:text-white text-lg"
                        aria-label="Fechar informação"
                    >
                        &times;
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <SensorCard icon={<Droplets className="text-blue-400" />} title="Umidade do Solo" value={`${sensorData.soilMoisture || 0}%`} />
                <SensorCard icon={<Thermometer className="text-red-400" />} title="Temperatura" value={`${sensorData.temperature || 0}°C`} />
                <SensorCard icon={<Cloud className="text-sky-400" />} title="Umidade do Ar" value={`${sensorData.humidity || 0}%`} />
                <SensorCard icon={<Zap className="text-yellow-400" />} title="Nível de Luz" value={`${sensorData.lightLevel || 0} lux`} />
            </div>
             <button 
                onClick={updateMockSensorData}
                className="mb-8 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-150 ease-in-out flex items-center justify-center"
            >
                <Leaf size={20} className="mr-2"/> Atualizar Dados Mock dos Sensores
            </button>

            <section className="bg-gray-700 p-6 rounded-xl shadow-2xl">
                <h2 className="text-2xl sm:text-3xl font-semibold mb-6 text-green-300">Controle das Válvulas Solenoides</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <ValveControl
                        valveId="valve1"
                        name="Válvula Irrigação 1"
                        isOn={valveStates.valve1 || false}
                        onToggle={handleValveToggle}
                    />
                    <ValveControl
                        valveId="valve2"
                        name="Válvula Irrigação 2"
                        isOn={valveStates.valve2 || false}
                        onToggle={handleValveToggle}
                    />
                </div>
            </section>

            <footer className="mt-12 text-center text-gray-400 text-sm">
                <p>&copy; {new Date().getFullYear()} Horta Inteligente. Controle e Monitoramento.</p>
                <p className="mt-1">Para integrar com um ESP32: programe o ESP32 para ler sensores e enviar dados para o Firestore no caminho `{getSensorsPath()}`. Para controle, o ESP32 deve ler o estado das válvulas de `{getValvesPath()}` e acioná-las.</p>
            </footer>
        </div>
    );
}

// SensorCard Component
const SensorCard = ({ icon, title, value }) => (
    <div className="bg-gray-700 p-5 rounded-xl shadow-lg hover:shadow-green-500/30 transition-shadow duration-300 flex flex-col items-center">
        <div className="text-4xl mb-3">{icon}</div>
        <h3 className="text-lg font-semibold text-gray-200 mb-1 text-center">{title}</h3>
        <p className="text-3xl font-bold text-green-400">{value}</p>
    </div>
);

// ValveControl Component
const ValveControl = ({ valveId, name, isOn, onToggle }) => {
    const Icon = isOn ? Power : CircleSlash;
    const bgColor = isOn ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700';
    const buttonText = isOn ? 'Desligar' : 'Ligar';

    return (
        <div className="bg-gray-600 p-6 rounded-lg shadow-md flex flex-col items-center justify-between">
            <h4 className="text-xl font-medium text-gray-100 mb-3 text-center">{name}</h4>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isOn ? 'bg-green-500' : 'bg-gray-500'}`}>
                <Icon size={32} className="text-white" />
            </div>
            <p className={`text-lg font-semibold mb-4 ${isOn ? 'text-green-400' : 'text-red-400'}`}>
                {isOn ? 'ATIVA' : 'INATIVA'}
            </p>            
            <button
                onClick={() => onToggle(valveId)}
                className={`w-full font-semibold py-3 px-6 rounded-lg shadow-md transition duration-150 ease-in-out text-white ${bgColor} flex items-center justify-center`}
            >
                <Icon size={20} className="mr-2"/> {buttonText}
            </button>
        </div>
    );
};

export default App;
