import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, getDoc, collection, addDoc, deleteDoc, query } from 'firebase/firestore';
import { Cloud, Thermometer, Droplets, CircleSlash, Power, Leaf, Clock, Trash2, PlusCircle } from 'lucide-react';

// Global Firebase variables (these would be provided by the Canvas environment)
const firebaseConfigJson = typeof __firebase_config !== 'undefined' ? __firebase_config : '{}';
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-smart-garden';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

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
    if (!app && Object.keys(firebaseConfig).length === 0) {
        console.warn("Firebase config is empty. App will run with limited functionality.");
    }
}

// Firestore paths (Corrected Structure)
// A single document holds the state for sensors and valves.
const GARDEN_DOC_PATH_TEMPLATE = "artifacts/{appId}/public/data/garden/main"; 
// Schedules are a sub-collection under the main garden document.
const SCHEDULES_COLLECTION_PATH_TEMPLATE = "artifacts/{appId}/public/data/garden/main/schedules";

const getGardenDocPath = () => GARDEN_DOC_PATH_TEMPLATE.replace("{appId}", appId);
const getSchedulesPath = () => SCHEDULES_COLLECTION_PATH_TEMPLATE.replace("{appId}", appId);


// Main App Component
function App() {
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [sensorData, setSensorData] = useState({
        soilMoisture: 0,
        temperature: 0,
        humidity: 0,
    });
    const [valveStates, setValveStates] = useState({
        valve1: false,
        valve2: false,
    });
    const [schedules, setSchedules] = useState([]);
    const [newSchedule, setNewSchedule] = useState({ time: '', valveId: 'valve1' });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Firebase Authentication
    useEffect(() => {
        if (!auth) {
            console.warn("Auth service not available.");
            setIsAuthReady(true);
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
                    setIsAuthReady(true);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // Initialize/Ensure Firestore document exists
    const ensureFirestoreData = useCallback(async () => {
        if (!db || !isAuthReady || !userId) return;

        const gardenDocRef = doc(db, getGardenDocPath());

        try {
            const docSnap = await getDoc(gardenDocRef);
            if (!docSnap.exists()) {
                await setDoc(gardenDocRef, {
                    sensors: {
                        soilMoisture: 50,
                        temperature: 22,
                        humidity: 60,
                    },
                    valves: {
                        valve1: false,
                        valve2: false,
                    },
                    lastUpdated: new Date().toISOString(),
                });
            }
        } catch (e) {
            console.error("Error ensuring Firestore data:", e);
            setError("Erro ao inicializar dados no Firestore.");
        }
    }, [isAuthReady, userId]);


    // Firestore Data Subscriptions
    useEffect(() => {
        if (!db || !isAuthReady || !userId) {
            if (isAuthReady) setIsLoading(false);
            return;
        }
        
        ensureFirestoreData().then(() => {
            // Combined listener for sensors and valves from the main garden document
            const gardenDocRef = doc(db, getGardenDocPath());
            const unsubGarden = onSnapshot(gardenDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setSensorData(data.sensors || { soilMoisture: 0, temperature: 0, humidity: 0 });
                    setValveStates(data.valves || { valve1: false, valve2: false });
                }
                setIsLoading(false);
            }, (err) => {
                console.error("Error fetching garden data:", err);
                setError("Erro ao buscar dados da horta.");
                setIsLoading(false);
            });

            // Schedules listener (now with a valid collection path)
            const schedulesCollectionRef = collection(db, getSchedulesPath());
            const q = query(schedulesCollectionRef);
            const unsubSchedules = onSnapshot(q, (querySnapshot) => {
                const schedulesData = [];
                querySnapshot.forEach((doc) => {
                    schedulesData.push({ id: doc.id, ...doc.data() });
                });
                schedulesData.sort((a, b) => a.time.localeCompare(b.time));
                setSchedules(schedulesData);
            }, (err) => console.error("Error fetching schedules:", err));
            
            return () => {
                unsubGarden();
                unsubSchedules();
            };
        });

    }, [isAuthReady, userId, ensureFirestoreData]);

    const handleValveToggle = async (valveId) => {
        if (!db || !userId) return;
        const gardenDocRef = doc(db, getGardenDocPath());
        try {
            // Use dot notation to update a nested field
            const fieldPath = `valves.${valveId}`;
            await updateDoc(gardenDocRef, {
                [fieldPath]: !valveStates[valveId],
                lastUpdated: new Date().toISOString(),
            });
        } catch (e) {
            console.error("Error toggling valve:", e);
        }
    };
    
    const updateMockSensorData = async () => {
        if (!db) return;
        const gardenDocRef = doc(db, getGardenDocPath());
        const newSensorData = {
            soilMoisture: Math.floor(Math.random() * 101),
            temperature: Math.floor(Math.random() * 15) + 15,
            humidity: Math.floor(Math.random() * 51) + 40,
        };
        try {
            await updateDoc(gardenDocRef, {
                sensors: newSensorData,
                lastUpdated: new Date().toISOString(),
            });
        } catch (e) {
            console.error("Error updating mock sensor data:", e);
        }
    };

    const handleAddSchedule = async (e) => {
        e.preventDefault();
        if (!db || !newSchedule.time) {
            setError("Por favor, selecione um horário.");
            return;
        }
        const schedulesCollectionRef = collection(db, getSchedulesPath());
        try {
            await addDoc(schedulesCollectionRef, {
                time: newSchedule.time,
                valveId: newSchedule.valveId,
                createdAt: new Date().toISOString(),
            });
            setNewSchedule({ time: '', valveId: 'valve1' }); // Reset form
            setError(null);
        } catch (err) {
            console.error("Error adding schedule:", err);
            setError("Erro ao adicionar agendamento.");
        }
    };

    const handleDeleteSchedule = async (scheduleId) => {
        if (!db) return;
        const scheduleDocRef = doc(db, getSchedulesPath(), scheduleId);
        try {
            await deleteDoc(scheduleDocRef);
        } catch (err) {
            console.error("Error deleting schedule:", err);
        }
    };


    if (!isAuthReady || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-green-500"></div>
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
            </header>

            {error && (
                <div className="bg-red-700 text-white px-4 py-3 rounded-lg relative mb-6 shadow-lg">
                    <span>{error}</span>
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <SensorCard icon={<Droplets className="text-blue-400" />} title="Umidade do Solo" value={`${sensorData.soilMoisture || 0}%`} />
                <SensorCard icon={<Thermometer className="text-red-400" />} title="Temperatura" value={`${sensorData.temperature || 0}°C`} />
                <SensorCard icon={<Cloud className="text-sky-400" />} title="Umidade do Ar" value={`${sensorData.humidity || 0}%`} />
            </div>
             <button 
                onClick={updateMockSensorData}
                className="mb-8 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition"
            >
                Atualizar Dados Mock
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <section className="bg-gray-700 p-6 rounded-xl shadow-2xl">
                    <h2 className="text-2xl font-semibold mb-6 text-green-300">Controle Manual</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <ValveControl valveId="valve1" name="Válvula 1" isOn={valveStates.valve1} onToggle={handleValveToggle} />
                        <ValveControl valveId="valve2" name="Válvula 2" isOn={valveStates.valve2} onToggle={handleValveToggle} />
                    </div>
                </section>

                <section className="bg-gray-700 p-6 rounded-xl shadow-2xl">
                    <h2 className="text-2xl font-semibold mb-6 text-green-300">Agendamento de Irrigação</h2>
                    <form onSubmit={handleAddSchedule} className="flex flex-col sm:flex-row gap-4 mb-6">
                        <input 
                            type="time" 
                            value={newSchedule.time}
                            onChange={(e) => setNewSchedule({...newSchedule, time: e.target.value})}
                            className="bg-gray-600 text-white p-3 rounded-lg border-2 border-gray-500 focus:border-green-500 focus:outline-none flex-grow"
                        />
                        <select 
                            value={newSchedule.valveId}
                            onChange={(e) => setNewSchedule({...newSchedule, valveId: e.target.value})}
                            className="bg-gray-600 text-white p-3 rounded-lg border-2 border-gray-500 focus:border-green-500 focus:outline-none"
                        >
                            <option value="valve1">Válvula 1</option>
                            <option value="valve2">Válvula 2</option>
                        </select>
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold p-3 rounded-lg flex items-center justify-center gap-2">
                            <PlusCircle size={20} /> Adicionar
                        </button>
                    </form>
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                        {schedules.length > 0 ? schedules.map(schedule => (
                            <div key={schedule.id} className="bg-gray-600 p-3 rounded-lg flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Clock size={20} className="text-green-400" />
                                    <span className="font-mono text-lg">{schedule.time}</span>
                                    <span className="text-gray-300">{schedule.valveId === 'valve1' ? 'Válvula 1' : 'Válvula 2'}</span>
                                </div>
                                <button onClick={() => handleDeleteSchedule(schedule.id)} className="text-red-400 hover:text-red-300">
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        )) : <p className="text-gray-400 text-center">Nenhum horário agendado.</p>}
                    </div>
                </section>
            </div>
            
            <footer className="mt-12 text-center text-gray-400 text-sm">
                <p>O ESP32 deve ser programado para ler os horários de `{getSchedulesPath()}` e acionar as válvulas nos momentos definidos.</p>
            </footer>
        </div>
    );
}

const SensorCard = ({ icon, title, value }) => (
    <div className="bg-gray-700 p-5 rounded-xl shadow-lg hover:shadow-green-500/30 transition-shadow flex flex-col items-center">
        <div className="text-4xl mb-3">{icon}</div>
        <h3 className="text-lg font-semibold text-gray-200 mb-1 text-center">{title}</h3>
        <p className="text-3xl font-bold text-green-400">{value}</p>
    </div>
);

const ValveControl = ({ valveId, name, isOn, onToggle }) => {
    const Icon = isOn ? Power : CircleSlash;
    const bgColor = isOn ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700';
    return (
        <div className="bg-gray-600 p-6 rounded-lg shadow-md flex flex-col items-center justify-between">
            <h4 className="text-xl font-medium text-gray-100 mb-3 text-center">{name}</h4>
            <p className={`text-lg font-semibold mb-4 ${isOn ? 'text-green-400' : 'text-red-400'}`}>
                {isOn ? 'ATIVA' : 'INATIVA'}
            </p>            
            <button
                onClick={() => onToggle(valveId)}
                className={`w-full font-semibold py-3 px-6 rounded-lg shadow-md transition text-white ${bgColor} flex items-center justify-center`}
            >
                <Icon size={20} className="mr-2"/> {isOn ? 'Desligar' : 'Ligar'}
            </button>
        </div>
    );
};

export default App;
