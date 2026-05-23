import express, { Request, Response, NextFunction } from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  getCountFromServer,
  increment
} from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

// Initialize Firebase App and Firestore for server-side persistence
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const app = express();
const PORT = 3000;

// Body parser configuration for handling PDF file uploads as base64 strings
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

interface AuthenticatedRequest extends Request {
  user?: {
    localId: string;
    email: string;
    emailVerified?: boolean;
  };
}

// Function to clean document numbers for comparison (removing spaces, dots, dashes, etc.)
function sanitizeDocNum(val: string): string {
  return val.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

// Security Middleware to authenticate administrator using standard Firebase ID token
async function authenticateAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No se proporcionó token de sesión de administrador." });
  }
  const token = authHeader.substring(7);
  const firebaseApiKey = firebaseConfig.apiKey;

  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token })
    });

    if (!response.ok) {
      return res.status(401).json({ error: "La sesión ha expirado o no es válida." });
    }

    const data = (await response.json()) as any;
    if (data && data.users && data.users.length > 0) {
      req.user = data.users[0];
      next();
    } else {
      res.status(401).json({ error: "Administrador no verificado en Firebase Auth." });
    }
  } catch (error) {
    console.error("Error validando token en el servidor:", error);
    res.status(500).json({ error: "Fallo de conexión con Firebase Auth de Google." });
  }
}

// ==========================================
// PUBLIC API ENDPOINTS
// ==========================================

// 1. Visit Counter - Increments visitor metrics and retrieves numbers
app.post("/api/public/visit", async (req, res) => {
  try {
    const docRef = doc(db, "stats", "global");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      await updateDoc(docRef, { visitCount: increment(1) });
      const newCount = (docSnap.data().visitCount || 0) + 1;
      res.json({ visitCount: newCount });
    } else {
      await setDoc(docRef, { visitCount: 1 });
      res.json({ visitCount: 1 });
    }
  } catch (err) {
    console.error("Error setting stats:", err);
    res.status(500).json({ error: "Fallo al incrementar estadísticas." });
  }
});

// Retrieves only standard public visitor states without modifying
app.get("/api/public/stats-view", async (req, res) => {
  try {
    const docRef = doc(db, "stats", "global");
    const docSnap = await getDoc(docRef);
    const visitCount = docSnap.exists() ? (docSnap.data().visitCount || 0) : 0;

    const certsColl = collection(db, "certificates");
    const countSnap = await getCountFromServer(certsColl);
    const certificatesCount = countSnap.data().count;

    res.json({
      visitCount,
      certificatesCount
    });
  } catch (err) {
    console.error("Error viewing statistics:", err);
    res.status(500).json({ error: "Fallo al recabar estadísticas." });
  }
});

// 2. Query Certificates by Document Number (Case and formatting insensitive)
app.get("/api/public/certificates/:documentNumber", async (req, res) => {
  const docNum = req.params.documentNumber;
  if (!docNum) {
    return res.status(400).json({ error: "Número de documento requerido." });
  }
  try {
    const targetSanitized = sanitizeDocNum(docNum);
    const certsColl = collection(db, "certificates");
    const q = query(certsColl, where("sanitizedDoc", "==", targetSanitized));
    const qSnap = await getDocs(q);
    const results = qSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        documentNumber: data.documentNumber,
        pdfFileName: data.pdfFileName,
        createdAt: data.createdAt,
        hasPdf: !!data.pdfData
      };
    });
    res.json(results);
  } catch (error) {
    console.error("Error querying certificates:", error);
    res.status(500).json({ error: "Error al consultar la base de datos." });
  }
});

// 3. Stream direct PDF Content for downloaded Certificates
app.get("/api/public/certificates/:id/pdf", async (req, res) => {
  const id = req.params.id;
  try {
    const docRef = doc(db, "certificates", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({ error: "Certificado no encontrado." });
    }

    const cert = docSnap.data();
    if (!cert.pdfData) {
      return res.status(400).json({ error: "Este certificado no tiene archivo PDF asociado." });
    }

    const buffer = Buffer.from(cert.pdfData, "base64");
    res.contentType("application/pdf");
    const filename = cert.pdfFileName || `certificado_${cert.documentNumber}.pdf`;
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  } catch (error) {
    console.error("Error streaming certificate PDF:", error);
    res.status(500).json({ error: "Fallo al procesar el archivo PDF." });
  }
});

// ==========================================
// ADMIN API ENDPOINTS (AUTHENTICATED)
// ==========================================

// Get all certificates (excluding raw base64 string to keep payload clean, adding boolean flag)
app.get("/api/admin/certificates", authenticateAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const certsColl = collection(db, "certificates");
    const q = query(certsColl, orderBy("createdAt", "desc"));
    const qSnap = await getDocs(q);
    const sanitizedList = qSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        documentNumber: data.documentNumber,
        pdfFileName: data.pdfFileName,
        createdAt: data.createdAt,
        hasPdf: !!data.pdfData
      };
    });
    res.json(sanitizedList);
  } catch (error) {
    console.error("Error loading certificates:", error);
    res.status(500).json({ error: "Error cargando la lista de certificados." });
  }
});

// Post a new Certificate (allows document number and PDF raw data)
app.post("/api/admin/certificates", authenticateAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const { documentNumber, pdfData, pdfFileName } = req.body;

  if (!documentNumber) {
    return res.status(400).json({ error: "Por favor, ingrese el número de documento." });
  }
  if (!pdfData) {
    return res.status(400).json({ error: "Por favor, cargue un archivo PDF para el certificado." });
  }

  try {
    const generatedId = crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const newCert = {
      id: generatedId,
      documentNumber: documentNumber.trim(),
      sanitizedDoc: sanitizeDocNum(documentNumber),
      pdfData: pdfData,
      pdfFileName: pdfFileName || `certificado_${documentNumber.trim()}.pdf`,
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, "certificates", generatedId), newCert);

    const { pdfData: _, ...responseItem } = newCert;
    res.status(201).json({ ...responseItem, hasPdf: true });
  } catch (error) {
    console.error("Error creating certificate:", error);
    res.status(500).json({ error: "Error al registrar el certificado en el servidor." });
  }
});

// Edit Certificate details
app.put("/api/admin/certificates/:id", authenticateAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id;
  const { documentNumber, pdfData, pdfFileName } = req.body;

  try {
    const docRef = doc(db, "certificates", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({ error: "No se encontró el certificado solicitado." });
    }

    const current = docSnap.data();
    const updatedCert: any = {};

    if (documentNumber !== undefined) {
      updatedCert.documentNumber = documentNumber.trim();
      updatedCert.sanitizedDoc = sanitizeDocNum(documentNumber);
    }
    if (pdfData !== undefined) {
      updatedCert.pdfData = pdfData;
    }
    if (pdfFileName !== undefined) {
      updatedCert.pdfFileName = pdfFileName;
    }

    await updateDoc(docRef, updatedCert);

    res.json({
      id,
      documentNumber: updatedCert.documentNumber || current.documentNumber,
      pdfFileName: updatedCert.pdfFileName || current.pdfFileName,
      createdAt: current.createdAt,
      hasPdf: pdfData !== undefined ? !!pdfData : !!current.pdfData
    });
  } catch (error) {
    console.error("Error editing certificate:", error);
    res.status(500).json({ error: "Fallo al editar el certificado." });
  }
});

// Delete Certificate
app.delete("/api/admin/certificates/:id", authenticateAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id;
  try {
    const docRef = doc(db, "certificates", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({ error: "No se pudo encontrar el certificado para borrar." });
    }

    await deleteDoc(docRef);
    res.json({ success: true, message: "Certificado eliminado del repositorio." });
  } catch (error) {
    console.error("Error deleting certificate:", error);
    res.status(500).json({ error: "Fallo al borrar el certificado." });
  }
});

// Fetch complete metrics dashboard
app.get("/api/admin/dashboard-stats", authenticateAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const docRef = doc(db, "stats", "global");
    const docSnap = await getDoc(docRef);
    const visitCount = docSnap.exists() ? (docSnap.data().visitCount || 0) : 0;

    const certsColl = collection(db, "certificates");
    const countSnap = await getCountFromServer(certsColl);
    const certificatesCount = countSnap.data().count;

    res.json({
      certificatesCount,
      visitCount
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Error recopilando estadísticas." });
  }
});

// ==========================================
// VITE OR FRONTEND ASSET ROUTING
// ==========================================

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
