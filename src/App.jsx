import React, { useState, useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  deleteDoc
} from "firebase/firestore";
import { io } from "socket.io-client";
import {
  Activity,
  Radio,
  Lock,
  Unlock,
  BatteryWarning,
  Users,
  MapPin,
  Layers,
  Filter,
  LogOut,
  Sun,
  Moon,
  CheckCircle2,
  Trash2,
  UserCheck
} from "lucide-react";

import { auth, db, googleProvider } from "./config/firebase";
import { decryptMedicalRecordE2EE } from "./services/cryptoE2EE";
import {
  issueAdminJWSSession,
  refreshAdminJWSSession,
  getStoredAdminJWSSession,
  clearAdminJWSSession
} from "./services/jwsSessionService";

const currentHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || `http://${currentHost}:4000`;

const QUADRANTS = [
  { code: "ALL", name: "Toda la Gran Caracas", center: [10.488, -66.865], zoom: 12 },
  { code: "C-01", name: "Chacao", center: [10.496, -66.853], zoom: 14 },
  { code: "C-02", name: "Libertador", center: [10.503, -66.906], zoom: 14 },
  { code: "C-03", name: "Sucre / Petare", center: [10.481, -66.808], zoom: 14 },
  { code: "C-04", name: "Baruta", center: [10.456, -66.868], zoom: 14 },
  { code: "C-05", name: "El Hatillo", center: [10.425, -66.825], zoom: 14 }
];

const BRIGADES = [
  "Sin asignar (En espera de despacho)",
  "Protección Civil · Unidad PC-01 (Chacao)",
  "Cuerpo de Bomberos · Unidad B-14 (Libertador)",
  "Cruz Roja Venezolana · Ambulancia CR-08 (Sucre)",
  "Brigada Paramédica Motorizada · PM-04 (Baruta/Hatillo)"
];

// Gacetero de precision de sectores de Caracas para corregir coordenadas cuando el iPhone entra por IP HTTP local
const CARACAS_SECTOR_GAZETTEER = [
  {
    keywords: ["23 de enero", "calle el mirador", "el mirador", "monte piedad", "sierra maestra", "agua salud", "caño amarillo", "la planicie"],
    lat: 10.5094,
    lng: -66.9358,
    alt: 965,
    cuadrante: "C-02",
    zonaNombre: "Libertador (23 de Enero)"
  },
  {
    keywords: ["catia", "propatria", "perez bonalde", "casalta", "gramoven", "alta vista", "magallanes", "ruperto lugo"],
    lat: 10.5142,
    lng: -66.9465,
    alt: 950,
    cuadrante: "C-02",
    zonaNombre: "Libertador (Catia)"
  },
  {
    keywords: ["la pastora", "puerta caracas", "lidice", "manicomio", "cotiza", "altagracia"],
    lat: 10.5135,
    lng: -66.9195,
    alt: 990,
    cuadrante: "C-02",
    zonaNombre: "Libertador (La Pastora)"
  },
  {
    keywords: ["san martin", "artigas", "maternidad", "capuchinos", "san juan", "el silencio", "quinta crespo"],
    lat: 10.4912,
    lng: -66.9325,
    alt: 895,
    cuadrante: "C-02",
    zonaNombre: "Libertador (San Martín)"
  },
  {
    keywords: ["el paraiso", "la paz", "washington", "multi", "las fuentes", "vista alegre", "bella vista"],
    lat: 10.4848,
    lng: -66.9362,
    alt: 905,
    cuadrante: "C-02",
    zonaNombre: "Libertador (El Paraíso)"
  },
  {
    keywords: ["la vega", "las casitas", "montalban", "juan pablo ii", "antimano", "carapita", "mamera"],
    lat: 10.4725,
    lng: -66.944,
    alt: 940,
    cuadrante: "C-02",
    zonaNombre: "Libertador (Oeste)"
  },
  {
    keywords: ["caricuao", "ud2", "ud3", "ud4", "ud5", "ud7", "ruiz pineda", "las adjuntas", "macarao"],
    lat: 10.4352,
    lng: -66.9795,
    alt: 980,
    cuadrante: "C-02",
    zonaNombre: "Libertador (Caricuao)"
  },
  {
    keywords: ["el valle", "los jardines", "coche", "fuerte tiuna", "longaray"],
    lat: 10.4562,
    lng: -66.9065,
    alt: 885,
    cuadrante: "C-02",
    zonaNombre: "Libertador (El Valle)"
  },
  {
    keywords: ["santa rosalia", "el cementerio", "los rosales", "la bandera", "san pedro", "los chaguaramos", "santa monica", "ucv"],
    lat: 10.482,
    lng: -66.8965,
    alt: 880,
    cuadrante: "C-02",
    zonaNombre: "Libertador"
  },
  {
    keywords: ["candelaria", "bellas artes", "parque carabobo", "la hoyada", "centro", "catedral", "san agustin", "parque central", "san bernardino"],
    lat: 10.5038,
    lng: -66.9012,
    alt: 910,
    cuadrante: "C-02",
    zonaNombre: "Libertador (Centro)"
  },
  {
    keywords: ["el recreo", "sabana grande", "plaza venezuela", "chacaito", "la florida", "mariperez"],
    lat: 10.4945,
    lng: -66.8815,
    alt: 895,
    cuadrante: "C-02",
    zonaNombre: "Libertador (El Recreo)"
  },
  {
    keywords: ["petare", "sucre", "la california", "macaracuay", "el marques", "la urbina", "boleita", "los cortijos", "los dos caminos", "sebucan", "los chorros"],
    lat: 10.4815,
    lng: -66.8085,
    alt: 890,
    cuadrante: "C-03",
    zonaNombre: "Sucre / Petare"
  },
  {
    keywords: ["baruta", "las mercedes", "chuao", "cafetal", "santa paula", "prados del este", "santa fe", "la trinidad", "manzanares", "cumbres de curumo"],
    lat: 10.4565,
    lng: -66.8685,
    alt: 945,
    cuadrante: "C-04",
    zonaNombre: "Baruta"
  },
  {
    keywords: ["el hatillo", "la boyera", "los naranjos", "la lagunita", "oripoto"],
    lat: 10.4255,
    lng: -66.8255,
    alt: 1120,
    cuadrante: "C-05",
    zonaNombre: "El Hatillo"
  }
];

function resolveSectorCoordsFromAddress(addressText = "") {
  const norm = addressText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!norm.trim()) return null;

  for (const entry of CARACAS_SECTOR_GAZETTEER) {
    for (const kw of entry.keywords) {
      const kwNorm = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (norm.includes(kwNorm)) {
        return entry;
      }
    }
  }
  return null;
}

const DEMO_IDS_TO_CLEAN = ["SOS-901", "SOS-902", "SOS-903"];

export default function App() {
  // 1. Autenticacion del Administrador (Firebase + JWS)
  const [adminUser, setAdminUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login"); // "login" | "register" | "forgot"
  const [email, setEmail] = useState("admin@sismalert.com");
  const [password, setPassword] = useState("Admin123456");
  const [authMsg, setAuthMsg] = useState(null);
  const [jwsSession, setJwsSession] = useState(() => getStoredAdminJWSSession());

  // 2. Datos 100% Reales en Tiempo Real desde Firebase Firestore + WebSockets
  const [alerts, setAlerts] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [themeLight, setThemeLight] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState("alerts"); // "alerts" | "users"

  // 3. Filtros Administrativos SIG
  const [selectedQuadrant, setSelectedQuadrant] = useState("ALL");
  const [maxBatteryFilter, setMaxBatteryFilter] = useState(100);
  const [bloodFilter, setBloodFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // 4. Controles Geoespaciales Leaflet.js (RF-05 Mapa de Calor & RF-06 Clustering)
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [tileStyle, setTileStyle] = useState("tactical"); // "tactical" | "streets" | "satellite"
  const [currentZoom, setCurrentZoom] = useState(12);

  // 5. Modal de Desencriptado de Ficha Medica E2EE y Despacho
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [decryptedMedical, setDecryptedMedical] = useState(null);
  const [selectedBrigade, setSelectedBrigade] = useState(BRIGADES[0]);
  const [savingDispatch, setSavingDispatch] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const heatLayerRef = useRef(null);

  useEffect(() => {
    document.body.classList.toggle("theme-light", themeLight);
  }, [themeLight]);

  // ==========================================================================
  // AUTENTICACION FIREBASE + EMISION SILENCIOSA DE SESION JWS
  // ==========================================================================
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAdminUser(user);
      if (user) {
        const session = await issueAdminJWSSession({
          uid: user.uid,
          email: user.email,
          nombre: user.displayName || "Coordinador de Crisis"
        });
        setJwsSession(session);
      } else {
        clearAdminJWSSession();
        setJwsSession(null);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Auto-rotacion de token JWS a lo largo del uso de la consola
  useEffect(() => {
    if (!adminUser || !jwsSession) return;
    const timer = setInterval(async () => {
      const rotated = await refreshAdminJWSSession(jwsSession, {
        uid: adminUser.uid,
        email: adminUser.email
      });
      setJwsSession(rotated);
    }, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [adminUser, jwsSession]);

  // ==========================================================================
  // SINCRONIZACION 100% REAL CON FIREBASE FIRESTORE Y SOCKET.IO
  // ==========================================================================
  useEffect(() => {
    if (!adminUser) return;

    // Limpiar automaticamente cualquier alerta demo previa (SOS-901, SOS-902, SOS-903) si existia en Firestore
    DEMO_IDS_TO_CLEAN.forEach((demoId) => {
      deleteDoc(doc(db, "alerts", demoId)).catch(() => {});
    });

    // 1. Escuchar en vivo todas las alertas reales emitidas desde los telefonos (1 solo reporte por ciudadano)
    const unsubAlerts = onSnapshot(
      collection(db, "alerts"),
      (snapshot) => {
        const realDocs = [];
        snapshot.docs.forEach((d) => {
          const data = d.data();
          // Si habia quedado algun registro demo antiguo en la base de datos, lo borramos
          if (
            DEMO_IDS_TO_CLEAN.includes(d.id) ||
            DEMO_IDS_TO_CLEAN.includes(data.id) ||
            (data.ciudadanoNombre && data.ciudadanoNombre.startsWith("Alerta Entrante SOS-"))
          ) {
            deleteDoc(doc(db, "alerts", d.id)).catch(() => {});
            return;
          }
          realDocs.push({
            firestoreId: d.id,
            ...data
          });
        });

        realDocs.sort((a, b) => (b.clientSentAt || 0) - (a.clientSentAt || 0));

        // Deduplicar por ciudadano (uid o cedula) y borrar automaticamente duplicados en Firestore
        const seenCitizens = new Set();
        const uniqueAlerts = [];
        realDocs.forEach((item) => {
          const citizenKey = item.uid || item.cedula || item.ciudadanoNombre || item.firestoreId;
          if (seenCitizens.has(citizenKey)) {
            // Eliminar reporte duplicado antiguo de la misma persona
            deleteDoc(doc(db, "alerts", item.firestoreId)).catch(() => {});
          } else {
            seenCitizens.add(citizenKey);
            // Si la alerta tiene una direccion escrita (ej. 23 de enero calle el mirador) pero quedo con la coordenada por defecto de Chacao (10.4961), la corregimos automaticamente
            const matchedSector = resolveSectorCoordsFromAddress(item.direccion || "");
            if (
              matchedSector &&
              (!item.coordenadas ||
                (Math.abs((item.coordenadas.lat || 0) - 10.4961) < 0.002 &&
                  matchedSector.cuadrante !== "C-01"))
            ) {
              const correctedCoords = {
                lat: matchedSector.lat,
                lng: matchedSector.lng,
                alt: matchedSector.alt
              };
              item.coordenadas = correctedCoords;
              item.cuadrante = matchedSector.cuadrante;
              item.zonaNombre = matchedSector.zonaNombre;
              updateDoc(doc(db, "alerts", item.firestoreId), {
                coordenadas: correctedCoords,
                cuadrante: matchedSector.cuadrante,
                zonaNombre: matchedSector.zonaNombre
              }).catch(() => {});
            }
            uniqueAlerts.push(item);
          }
        });

        setAlerts(uniqueAlerts);
      },
      (err) => {
        console.warn("Error leyendo alertas de Firestore:", err);
      }
    );

    // 2. Escuchar en vivo los ciudadanos reales registrados en la app movil
    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          uid: d.id,
          ...d.data()
        }));
        list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        setRegisteredUsers(list);
      },
      () => {}
    );

    // 3. Conexion WebSocket en vivo con el servidor Backend
    const socket = io(BACKEND_URL, {
      query: { role: "admin", uid: adminUser.uid },
      transports: ["websocket", "polling"]
    });

    socket.on("connect", () => setWsConnected(true));
    socket.on("disconnect", () => setWsConnected(false));

    return () => {
      unsubAlerts();
      unsubUsers();
      socket.disconnect();
    };
  }, [adminUser]);

  // ==========================================================================
  // FILTRADO DE ALERTAS REALES
  // ==========================================================================
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (selectedQuadrant !== "ALL" && a.cuadrante !== selectedQuadrant) return false;
      if ((a.bateriaNivel ?? 100) > maxBatteryFilter) return false;
      if (bloodFilter !== "ALL" && a.tipoSangreResumen !== bloodFilter) return false;
      if (statusFilter !== "ALL" && a.estado !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (a.ciudadanoNombre || "").toLowerCase().includes(q);
        const matchId = (a.id || "").toLowerCase().includes(q);
        const matchCi = (a.cedula || "").toLowerCase().includes(q);
        const matchAllergy = (a.alergiasResumen || "").toLowerCase().includes(q);
        if (!matchName && !matchId && !matchCi && !matchAllergy) return false;
      }
      return true;
    });
  }, [alerts, selectedQuadrant, maxBatteryFilter, bloodFilter, statusFilter, searchQuery]);

  // ==========================================================================
  // INICIALIZACION Y ACTUALIZACION DEL MAPA INTERACTIVO LEAFLET.JS
  // ==========================================================================
  useEffect(() => {
    if (!adminUser || !mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [10.488, -66.865],
      zoom: 12,
      zoomControl: false
    });

    const tileUrl =
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: "Cartografia SIG Gran Caracas · Esri ArcGIS"
    }).addTo(map);

    heatLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    map.on("zoomend", () => {
      setCurrentZoom(map.getZoom());
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [adminUser]);

  // Cambio de estilo de cartografia
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    let url =
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
    if (tileStyle === "satellite") {
      url =
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    } else if (tileStyle === "tactical") {
      url =
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
    }
    tileLayerRef.current.setUrl(url);
  }, [tileStyle]);

  // Pintado de Mapa de Calor (RF-05) y Clustering / Pines (RF-06) con datos 100% reales
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !heatLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    heatLayerRef.current.clearLayers();

    // 1. Capa de Mapa de Calor (RF-05)
    if (showHeatmap) {
      filteredAlerts.forEach((a) => {
        const lat = a.coordenadas?.lat || 10.495;
        const lng = a.coordenadas?.lng || -66.853;
        const weight = Math.min(1, (a.personasEnSitio || 1) / 15);
        const radiusMeters = 750 + weight * 650;

        L.circle([lat, lng], {
          radius: radiusMeters,
          stroke: false,
          fillColor: a.estado === "RESCATADO" ? "#00e699" : "#ff2a54",
          fillOpacity: 0.24
        }).addTo(heatLayerRef.current);

        L.circle([lat, lng], {
          radius: radiusMeters * 0.5,
          stroke: false,
          fillColor: "#ffb800",
          fillOpacity: 0.3
        }).addTo(heatLayerRef.current);
      });
    }

    // 2. Agrupacion Dinamica (Clustering RF-06) cuando el zoom es general (<= 12)
    if (showClusters && currentZoom <= 12) {
      const grouped = {};
      filteredAlerts.forEach((a) => {
        const code = a.cuadrante || "C-01";
        if (!grouped[code]) {
          grouped[code] = {
            code,
            name: a.zonaNombre || code,
            countAlerts: 0,
            totalPersons: 0,
            latSum: 0,
            lngSum: 0
          };
        }
        grouped[code].countAlerts += 1;
        grouped[code].totalPersons += Number(a.personasEnSitio) || 1;
        grouped[code].latSum += a.coordenadas?.lat || 10.495;
        grouped[code].lngSum += a.coordenadas?.lng || -66.853;
      });

      Object.values(grouped).forEach((g) => {
        const centerLat = g.latSum / g.countAlerts;
        const centerLng = g.lngSum / g.countAlerts;
        const icon = L.divIcon({
          className: "",
          html: `<div class="custom-cluster-pin" style="width:58px;height:58px;background:rgba(255,42,84,0.88);">
            <span style="font-size:1.05rem;line-height:1;">${g.totalPersons}</span>
            <span style="font-size:0.58rem;font-family:monospace;">pers.</span>
          </div>`,
          iconSize: [58, 58],
          iconAnchor: [29, 29]
        });

        const marker = L.marker([centerLat, centerLng], { icon });
        marker.on("click", () => {
          mapInstanceRef.current.setView([centerLat, centerLng], 14, { animate: true });
        });
        marker.addTo(markersLayerRef.current);
      });
    } else {
      // Vista detallada de pines individuales reales
      filteredAlerts.forEach((a) => {
        const lat = a.coordenadas?.lat || 10.495;
        const lng = a.coordenadas?.lng || -66.853;
        const color =
          a.estado === "RESCATADO"
            ? "#00e699"
            : a.estado === "EN_RUTA"
            ? "#ffb800"
            : "#ff2a54";

        const icon = L.divIcon({
          className: "",
          html: `<div class="custom-sos-pin" style="width:22px;height:22px;background:${color};"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        const marker = L.marker([lat, lng], { icon });
        marker.on("click", () => handleOpenMedicalModal(a));
        marker.addTo(markersLayerRef.current);
      });
    }
  }, [filteredAlerts, showHeatmap, showClusters, currentZoom]);

  // ==========================================================================
  // APERTURA Y DESENCRIPTADO E2EE DE LA FICHA MEDICA REAL + DESPACHO
  // ==========================================================================
  const handleOpenMedicalModal = async (alertItem) => {
    setSelectedAlert(alertItem);
    setSelectedBrigade(alertItem.brigadaAsignada || BRIGADES[0]);
    setDecryptedMedical(null);

    if (alertItem.fichaMedicaE2EE) {
      const plain = await decryptMedicalRecordE2EE(alertItem.fichaMedicaE2EE);
      if (plain) {
        setDecryptedMedical(plain);
        return;
      }
    }

    setDecryptedMedical({
      nombreCompleto: alertItem.ciudadanoNombre,
      cedula: alertItem.cedula,
      tipoSangre: alertItem.tipoSangreResumen || "O+",
      alergias: alertItem.alergiasResumen || "Ninguna",
      condicionesMedicas: alertItem.condicionResumen || "Ninguna",
      medicamentos: "Ninguno",
      contactoEmergenciaNombre: "Familiar",
      contactoEmergenciaTelefono: alertItem.telefono || "No especificado"
    });
  };

  const handleUpdateAlertStatus = async (nuevoEstado) => {
    if (!selectedAlert) return;
    setSavingDispatch(true);
    try {
      const targetDocId = selectedAlert.firestoreId || selectedAlert.id;
      await updateDoc(doc(db, "alerts", targetDocId), {
        estado: nuevoEstado,
        brigadaAsignada: selectedBrigade,
        updatedAt: new Date().toISOString()
      });

      await addDoc(collection(db, "audit_logs"), {
        eventType: "ADMIN_DISPATCH_UPDATE",
        actor: adminUser.email,
        channel: "ADMIN_CONSOLE",
        detail: `Caso ${selectedAlert.id} (${selectedAlert.ciudadanoNombre}) actualizado a ${nuevoEstado} — ${selectedBrigade}`,
        timestamp: new Date().toISOString()
      });

      // Notificar en vivo al telefono del ciudadano por WebSocket
      await fetch(`${BACKEND_URL}/api/sos/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertId: selectedAlert.id,
          uid: selectedAlert.uid,
          nuevoEstado,
          brigadaAsignada: selectedBrigade,
          operador: adminUser.email
        })
      }).catch(() => {});

      setSelectedAlert((prev) =>
        prev ? { ...prev, estado: nuevoEstado, brigadaAsignada: selectedBrigade } : null
      );
    } catch (err) {
      console.error("Error actualizando despacho:", err);
    } finally {
      setSavingDispatch(false);
    }
  };

  const handleDeleteAlertRecord = async (alertItem) => {
    const targetDocId = alertItem.firestoreId || alertItem.id;
    try {
      await deleteDoc(doc(db, "alerts", targetDocId));
      if (selectedAlert && (selectedAlert.firestoreId || selectedAlert.id) === targetDocId) {
        setSelectedAlert(null);
      }
    } catch (err) {
      console.error("Error eliminando alerta:", err);
    }
  };

  // ==========================================================================
  // PANTALLA DE LOGIN ADMINISTRATIVO
  // ==========================================================================
  if (authLoading) {
    return (
      <div className="admin-auth-screen">
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
          Cargando Centro de Control SismAlert...
        </div>
      </div>
    );
  }

  if (!adminUser) {
    return (
      <div className="admin-auth-screen">
        <div className="admin-auth-card">
          {authMode !== "login" && (
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setAuthMsg(null);
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                fontSize: "0.82rem",
                marginBottom: 14
              }}
            >
              <span>← Volver al inicio de sesión</span>
            </button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div className="admin-brand-mark">
              <Activity size={24} />
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 700 }}>
                SismAlert · Administración
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2 }}>
                Centro de Coordinación y Gestión de Emergencias
              </div>
            </div>
          </div>

          {authMsg && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(255,42,84,0.14)",
                border: "1px solid rgba(255,42,84,0.4)",
                fontSize: "0.8rem",
                marginBottom: 14
              }}
            >
              {authMsg}
            </div>
          )}

          <form
            style={{ display: "flex", flexDirection: "column", gap: 13 }}
            onSubmit={async (e) => {
              e.preventDefault();
              setAuthMsg(null);
              try {
                if (authMode === "login") {
                  try {
                    await signInWithEmailAndPassword(auth, email.trim(), password);
                  } catch (loginErr) {
                    if (
                      email.trim().toLowerCase() === "admin@sismalert.com" &&
                      (loginErr.code === "auth/user-not-found" ||
                        loginErr.code === "auth/invalid-credential")
                    ) {
                      await createUserWithEmailAndPassword(auth, email.trim(), password);
                    } else {
                      throw loginErr;
                    }
                  }
                } else if (authMode === "register") {
                  await createUserWithEmailAndPassword(auth, email.trim(), password);
                } else {
                  await sendPasswordResetEmail(auth, email.trim());
                  setAuthMsg("Enlace de recuperación enviado a su correo.");
                }
              } catch {
                setAuthMsg("Credenciales incorrectas o cuenta no registrada.");
              }
            }}
          >
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                Correo electrónico
              </label>
              <input
                type="email"
                required
                className="admin-input"
                style={{ marginTop: 6 }}
                placeholder="admin@sismalert.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {authMode !== "forgot" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                    Contraseña
                  </label>
                  {authMode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("forgot");
                        setAuthMsg(null);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent-cyan)",
                        cursor: "pointer",
                        fontSize: "0.76rem"
                      }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  className="admin-input"
                  style={{ marginTop: 6 }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}

            <button type="submit" className="tactical-btn btn-crimson" style={{ width: "100%", marginTop: 4 }}>
              {authMode === "login" && "Iniciar sesión"}
              {authMode === "register" && "Crear cuenta de administrador"}
              {authMode === "forgot" && "Enviar enlace de recuperación"}
            </button>

            <button
              type="button"
              className="tactical-btn"
              style={{
                width: "100%",
                background: "#ffffff",
                color: "#1e293b",
                border: "1px solid #e2e8f0"
              }}
              onClick={() =>
                signInWithPopup(auth, googleProvider).catch(() =>
                  setAuthMsg("No se pudo iniciar sesión con Google.")
                )
              }
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              <span>Continuar con Google</span>
            </button>

            <div style={{ textAlign: "center", marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent-cyan)",
                  cursor: "pointer",
                  fontSize: "0.8rem"
                }}
              >
                {authMode === "login" ? "¿Nuevo operador? Regístrate aquí" : "Ya tengo una cuenta"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Metricas KPI 100% Reales
  const totalPersonasAfectadas = alerts.reduce(
    (acc, a) => acc + (Number(a.personasEnSitio) || 1),
    0
  );
  const criticosBateria = alerts.filter((a) => (a.bateriaNivel ?? 100) <= 15).length;
  const pendientesCount = alerts.filter((a) => a.estado === "PENDIENTE").length;
  const enRutaCount = alerts.filter((a) => a.estado === "EN_RUTA").length;
  const rescatadosCount = alerts.filter((a) => a.estado === "RESCATADO").length;

  return (
    <div>
      {/* CABECERA SUPERIOR DE SALA DE MANDO */}
      <header className="admin-topbar">
        <div className="admin-brand">
          <div className="admin-brand-mark">
            <Activity size={22} />
          </div>
          <div>
            <div className="admin-brand-title">
              SismAlert
              <span className="admin-badge">Centro de Control</span>
            </div>
            <div className="admin-brand-sub">
              Monitoreo Sísmico y Coordinación de Rescate en Tiempo Real — Gran Caracas
            </div>
          </div>
        </div>

        <div className="admin-status-cluster">
          <div className="status-pill">
            <Radio size={14} color={wsConnected ? "var(--accent-emerald)" : "var(--accent-amber)"} />
            <span>{wsConnected ? "Recepción en vivo activa" : "Sincronizado con Firebase"}</span>
          </div>

          <button type="button" className="tactical-btn" onClick={() => setThemeLight(!themeLight)}>
            {themeLight ? <Moon size={16} /> : <Sun size={16} />}
            {themeLight ? "Modo Noche" : "Modo Día"}
          </button>

          <button type="button" className="tactical-btn" onClick={() => signOut(auth)}>
            <LogOut size={15} />
            Salir
          </button>
        </div>
      </header>

      {/* 4 TARJETAS DE INDICADORES CLAVE REALES (KPIs) */}
      <section className="kpi-strip">
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Personas en Alertas Activas</div>
            <div className="kpi-value">{totalPersonasAfectadas}</div>
            <div className="kpi-sub">En {alerts.length} reporte(s) SOS recibidos</div>
          </div>
          <Users size={28} color="var(--accent-crimson)" />
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">Prioridad por Batería Baja</div>
            <div className="kpi-value" style={{ color: "var(--accent-amber)" }}>
              {criticosBateria}
            </div>
            <div className="kpi-sub">Teléfonos con &lt;= 15% de batería</div>
          </div>
          <BatteryWarning size={28} color="var(--accent-amber)" />
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">Ciudadanos Registrados</div>
            <div className="kpi-value" style={{ color: "var(--accent-cyan)" }}>
              {registeredUsers.length}
            </div>
            <div className="kpi-sub">Usuarios reales en la base de datos</div>
          </div>
          <UserCheck size={28} color="var(--accent-cyan)" />
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">Estado de Atención y Rescate</div>
            <div className="kpi-value" style={{ color: "var(--accent-emerald)" }}>
              {pendientesCount} Pendientes
            </div>
            <div className="kpi-sub">
              {enRutaCount} En Ruta · {rescatadosCount} Rescatados
            </div>
          </div>
          <CheckCircle2 size={28} color="var(--accent-emerald)" />
        </div>
      </section>

      {/* DISTRIBUCION DE 3 COLUMNAS: FILTROS | MAPA LEAFLET | SOLICITUDES REALES */}
      <main className="command-grid">
        {/* COLUMNA 1: SEGMENTACION Y FILTROS */}
        <aside className="panel-box">
          <div className="panel-header">
            <div>
              <div className="panel-kicker">Filtros e Indicadores</div>
              <div className="panel-title">Zonas y Priorización</div>
            </div>
            <button
              type="button"
              className="tactical-btn"
              onClick={() => {
                setSelectedQuadrant("ALL");
                setMaxBatteryFilter(100);
                setBloodFilter("ALL");
                setStatusFilter("ALL");
                setSearchQuery("");
              }}
            >
              Ver Todo
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--text-secondary)" }}>
              Personas Afectadas por Municipio
            </div>
            {QUADRANTS.map((q) => {
              const count =
                q.code === "ALL"
                  ? totalPersonasAfectadas
                  : alerts
                      .filter((a) => a.cuadrante === q.code)
                      .reduce((acc, a) => acc + (Number(a.personasEnSitio) || 1), 0);
              return (
                <button
                  key={q.code}
                  type="button"
                  className={`tactical-btn ${selectedQuadrant === q.code ? "active" : ""}`}
                  style={{ justifyContent: "space-between", width: "100%" }}
                  onClick={() => {
                    setSelectedQuadrant(q.code);
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.setView(q.center, q.zoom, { animate: true });
                    }
                  }}
                >
                  <span>{q.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)" }}>{count} pers.</span>
                </button>
              );
            })}
          </div>

          {/* Filtro por Bateria del Telefono */}
          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.76rem",
                fontWeight: 600,
                marginBottom: 8
              }}
            >
              <span>Filtrar por Batería del Teléfono</span>
              <span style={{ color: "var(--accent-amber)" }}>&lt;= {maxBatteryFilter}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              value={maxBatteryFilter}
              onChange={(e) => setMaxBatteryFilter(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--accent-amber)" }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 8 }}>
              <button
                type="button"
                className={`tactical-btn ${maxBatteryFilter === 15 ? "active" : ""}`}
                onClick={() => setMaxBatteryFilter(15)}
              >
                &lt;=15% Crítica
              </button>
              <button
                type="button"
                className={`tactical-btn ${maxBatteryFilter === 30 ? "active" : ""}`}
                onClick={() => setMaxBatteryFilter(30)}
              >
                &lt;=30% Baja
              </button>
              <button
                type="button"
                className={`tactical-btn ${maxBatteryFilter === 100 ? "active" : ""}`}
                onClick={() => setMaxBatteryFilter(100)}
              >
                Todas
              </button>
            </div>
          </div>

          {/* Filtro por Sangre */}
          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
            <div style={{ fontSize: "0.76rem", fontWeight: 600, marginBottom: 8 }}>
              Filtrar por Tipo de Sangre
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {["ALL", "O-", "O+", "A-", "A+", "B-", "B+", "AB+"].map((bt) => (
                <button
                  key={bt}
                  type="button"
                  className={`tactical-btn ${bloodFilter === bt ? "active" : ""}`}
                  onClick={() => setBloodFilter(bt)}
                >
                  {bt === "ALL" ? "Todos" : bt}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* COLUMNA 2: MAPA GEOESPACIAL INTERACTIVO (LEAFLET.JS) */}
        <section className="panel-box">
          <div className="panel-header" style={{ flexWrap: "wrap" }}>
            <div>
              <div className="panel-kicker">Mapa Geoespacial en Tiempo Real</div>
              <div className="panel-title">Mapa de Calor y Agrupación de Alertas — Gran Caracas</div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button
                type="button"
                className={`tactical-btn ${showHeatmap ? "active" : ""}`}
                onClick={() => setShowHeatmap(!showHeatmap)}
              >
                <Layers size={15} />
                Mapa de Calor
              </button>
              <button
                type="button"
                className={`tactical-btn ${showClusters ? "active" : ""}`}
                onClick={() => setShowClusters(!showClusters)}
              >
                <Filter size={15} />
                Agrupar (Clusters)
              </button>
              <button
                type="button"
                className={`tactical-btn ${tileStyle === "tactical" ? "active" : ""}`}
                onClick={() => setTileStyle("tactical")}
              >
                Táctico
              </button>
              <button
                type="button"
                className={`tactical-btn ${tileStyle === "streets" ? "active" : ""}`}
                onClick={() => setTileStyle("streets")}
              >
                Calles
              </button>
              <button
                type="button"
                className={`tactical-btn ${tileStyle === "satellite" ? "active" : ""}`}
                onClick={() => setTileStyle("satellite")}
              >
                Satélite
              </button>
            </div>
          </div>

          <div ref={mapContainerRef} className="map-container-frame" />
        </section>

        {/* COLUMNA 3: SOLICITUDES DE AUXILIO REALES Y CIUDADANOS REGISTRADOS */}
        <aside className="panel-box">
          <div className="panel-header" style={{ flexWrap: "wrap", gap: 8 }}>
            <div>
              <div className="panel-kicker">Atención y Monitoreo en Vivo</div>
              <div className="panel-title">
                {rightPanelTab === "alerts"
                  ? `Solicitudes de Auxilio (${filteredAlerts.length})`
                  : `Ciudadanos Registrados (${registeredUsers.length})`}
              </div>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className={`tactical-btn ${rightPanelTab === "alerts" ? "active" : ""}`}
                style={{ minHeight: 36, padding: "5px 10px", fontSize: "0.73rem" }}
                onClick={() => setRightPanelTab("alerts")}
              >
                Alertas ({alerts.length})
              </button>
              <button
                type="button"
                className={`tactical-btn ${rightPanelTab === "users" ? "active" : ""}`}
                style={{ minHeight: 36, padding: "5px 10px", fontSize: "0.73rem" }}
                onClick={() => setRightPanelTab("users")}
              >
                Usuarios ({registeredUsers.length})
              </button>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <input
              type="text"
              className="admin-input"
              placeholder={
                rightPanelTab === "alerts"
                  ? "Buscar alerta por nombre, cédula o sangre..."
                  : "Buscar ciudadano registrado..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* LISTA DE ALERTAS REALES */}
          {rightPanelTab === "alerts" && (
            <div className="alert-queue-list">
              {filteredAlerts.length === 0 ? (
                <div
                  style={{
                    padding: "28px 16px",
                    textAlign: "center",
                    color: "var(--text-secondary)",
                    fontSize: "0.84rem",
                    lineHeight: 1.5,
                    background: "var(--bg-card)",
                    borderRadius: 12,
                    border: "1px dashed var(--border-subtle)"
                  }}
                >
                  <strong>Sin alertas SOS activas en este momento.</strong>
                  <div style={{ marginTop: 6, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    Cuando tú o tus compañeros presionen el botón SOS desde la aplicación del teléfono, la alerta aparecerá aquí y en el mapa en tiempo real.
                  </div>
                </div>
              ) : (
                filteredAlerts.map((item) => (
                  <div key={item.firestoreId || item.id} className={`alert-card status-${item.estado}`}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem" }}>
                        {item.ciudadanoNombre}
                      </span>
                      <span className="chip-badge" style={{ background: "rgba(255,42,84,0.16)", color: "#fda4af" }}>
                        {item.estado}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      {item.zonaNombre || item.cuadrante} · Cédula: {item.cedula} · {item.personasEnSitio || 1} pers.
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <span
                        className="chip-badge"
                        style={{
                          background:
                            (item.bateriaNivel ?? 50) <= 15
                              ? "rgba(255,42,84,0.2)"
                              : "rgba(0,229,255,0.12)",
                          color:
                            (item.bateriaNivel ?? 50) <= 15 ? "#fda4af" : "var(--accent-cyan)"
                        }}
                      >
                        Batería: {item.bateriaNivel}%
                      </span>
                      <span className="chip-badge" style={{ background: "rgba(168,85,247,0.16)", color: "#e9d5ff" }}>
                        Sangre: {item.tipoSangreResumen || "O+"}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        className="tactical-btn"
                        style={{
                          background: "rgba(0, 229, 255, 0.14)",
                          borderColor: "var(--accent-cyan)",
                          color: "var(--accent-cyan)"
                        }}
                        onClick={() => handleOpenMedicalModal(item)}
                      >
                        <Unlock size={15} />
                        Ver Ficha Médica / Asignar
                      </button>
                      <button
                        type="button"
                        className="tactical-btn"
                        onClick={() => {
                          if (mapInstanceRef.current && item.coordenadas) {
                            mapInstanceRef.current.setView(
                              [item.coordenadas.lat, item.coordenadas.lng],
                              15,
                              { animate: true }
                            );
                          }
                        }}
                      >
                        <MapPin size={15} />
                        Mapa
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* LISTA DE CIUDADANOS REALES REGISTRADOS */}
          {rightPanelTab === "users" && (
            <div className="alert-queue-list">
              {registeredUsers.length === 0 ? (
                <div
                  style={{
                    padding: "28px 16px",
                    textAlign: "center",
                    color: "var(--text-secondary)",
                    fontSize: "0.84rem",
                    background: "var(--bg-card)",
                    borderRadius: 12
                  }}
                >
                  Aún no hay ciudadanos registrados en Firebase.
                </div>
              ) : (
                registeredUsers
                  .filter((u) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      (u.nombreCompleto || "").toLowerCase().includes(q) ||
                      (u.cedula || "").toLowerCase().includes(q) ||
                      (u.email || "").toLowerCase().includes(q)
                    );
                  })
                  .map((u) => (
                    <div
                      key={u.uid}
                      className="alert-card"
                      style={{ borderLeftColor: u.fichaMedicaCompletada ? "var(--accent-emerald)" : "var(--accent-cyan)" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.92rem" }}>
                          {u.nombreCompleto || u.email}
                        </span>
                        <span
                          className="chip-badge"
                          style={{
                            background: u.fichaMedicaCompletada
                              ? "rgba(0,230,153,0.16)"
                              : "rgba(255,184,0,0.15)",
                            color: u.fichaMedicaCompletada ? "#6ee7b7" : "#fde047"
                          }}
                        >
                          {u.fichaMedicaCompletada ? `Ficha Lista (${u.tipoSangreResumen || "O+"})` : "Sin Ficha"}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        Cédula: {u.cedula || "Pendiente"} · Tel: {u.telefono || "Pendiente"}
                      </div>
                      <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                        {u.direccion || "Dirección aún no especificada"}
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
        </aside>
      </main>

      {/* MODAL DE FICHA MEDICA DESBLOQUEADA Y ASIGNACION DE RESCATE */}
      {selectedAlert && (
        <div className="e2ee-modal-backdrop" onClick={() => setSelectedAlert(null)}>
          <div className="e2ee-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="panel-kicker" style={{ color: "var(--accent-violet)" }}>
                  FICHA MÉDICA DEL CIUDADANO
                </div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", marginTop: 4 }}>
                  Datos Médicos y Asignación de Rescate
                </h3>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="tactical-btn"
                  style={{ color: "#fda4af", borderColor: "rgba(255,42,84,0.35)" }}
                  onClick={() => handleDeleteAlertRecord(selectedAlert)}
                  title="Eliminar esta alerta de la base de datos"
                >
                  <Trash2 size={15} />
                  Eliminar
                </button>
                <button type="button" className="tactical-btn" onClick={() => setSelectedAlert(null)}>
                  Cerrar
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginTop: 16
              }}
            >
              <div style={{ background: "var(--bg-card)", padding: 12, borderRadius: 10 }}>
                <div className="kpi-label">Ciudadano Afectado</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>
                  {selectedAlert.ciudadanoNombre} ({selectedAlert.cedula})
                </div>
                <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: 3 }}>
                  Teléfono: {selectedAlert.telefono}
                </div>
              </div>

              <div style={{ background: "var(--bg-card)", padding: 12, borderRadius: 10 }}>
                <div className="kpi-label">Ubicación y Personas</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>
                  {selectedAlert.zonaNombre} · {selectedAlert.personasEnSitio || 1} persona(s)
                </div>
                <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: 3 }}>
                  Batería del teléfono: {selectedAlert.bateriaNivel}%
                </div>
              </div>

              <div style={{ background: "var(--bg-card)", padding: 12, borderRadius: 10 }}>
                <div className="kpi-label">Tipo de Sangre</div>
                <div style={{ fontWeight: 700, fontSize: "1.15rem", color: "var(--accent-crimson)", marginTop: 4 }}>
                  {decryptedMedical?.tipoSangre || selectedAlert.tipoSangreResumen}
                </div>
              </div>

              <div style={{ background: "var(--bg-card)", padding: 12, borderRadius: 10 }}>
                <div className="kpi-label">Alergias a Medicamentos</div>
                <div style={{ fontWeight: 700, color: "var(--accent-amber)", marginTop: 4 }}>
                  {decryptedMedical?.alergias || selectedAlert.alergiasResumen}
                </div>
              </div>
            </div>

            <div style={{ background: "var(--bg-card)", padding: 12, borderRadius: 10, marginTop: 12 }}>
              <div className="kpi-label">Información Médica y Dirección</div>
              <div style={{ fontSize: "0.86rem", marginTop: 5 }}>
                <strong>Dirección:</strong> {selectedAlert.direccion}
              </div>
              <div style={{ fontSize: "0.86rem", marginTop: 4 }}>
                <strong>Condiciones médicas:</strong>{" "}
                {decryptedMedical?.condicionesMedicas || selectedAlert.condicionResumen}
              </div>
              {decryptedMedical?.medicamentos && (
                <div style={{ fontSize: "0.86rem", marginTop: 4 }}>
                  <strong>Medicamentos:</strong> {decryptedMedical.medicamentos}
                </div>
              )}
              {decryptedMedical?.contactoEmergenciaNombre && (
                <div style={{ fontSize: "0.86rem", marginTop: 4 }}>
                  <strong>Contacto de emergencia:</strong> {decryptedMedical.contactoEmergenciaNombre} (
                  {decryptedMedical.contactoEmergenciaTelefono})
                </div>
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <label className="kpi-label">Asignar Brigada de Rescate y Cambiar Estado</label>
              <select
                className="admin-input"
                style={{ marginTop: 6 }}
                value={selectedBrigade}
                onChange={(e) => setSelectedBrigade(e.target.value)}
              >
                {BRIGADES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  disabled={savingDispatch}
                  className="tactical-btn btn-crimson"
                  onClick={() => handleUpdateAlertStatus("PENDIENTE")}
                >
                  Pendiente
                </button>
                <button
                  type="button"
                  disabled={savingDispatch}
                  className="tactical-btn"
                  style={{ borderColor: "var(--accent-amber)", color: "var(--accent-amber)" }}
                  onClick={() => handleUpdateAlertStatus("EN_RUTA")}
                >
                  Brigada en Ruta
                </button>
                <button
                  type="button"
                  disabled={savingDispatch}
                  className="tactical-btn"
                  style={{ borderColor: "var(--accent-emerald)", color: "var(--accent-emerald)" }}
                  onClick={() => handleUpdateAlertStatus("RESCATADO")}
                >
                  Rescatado / Atendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
