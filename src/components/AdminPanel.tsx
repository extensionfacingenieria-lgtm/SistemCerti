import React, { useState, useEffect } from "react";
import { Certificate } from "../types";
import { 
  Plus, Edit2, Trash2, LogOut, Award, Eye, FileText, Search, 
  Upload, X, RefreshCw, FileCheck, Database
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

interface AdminPanelProps {
  token: string;
  onLogout: () => void;
  onSelectPrint?: (cert: Certificate) => void;
}

export default function AdminPanel({ token, onLogout }: AdminPanelProps) {
  // Statistics States
  const [certs, setCerts] = useState<(Certificate & { hasPdf: boolean })[]>([]);
  const [stats, setStats] = useState({ certificatesCount: 0, visitCount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals / Form States
  const [formOpen, setFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form Field States
  const [documentNumber, setDocumentNumber] = useState("");
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Delete Confirm State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchAllData = async () => {
    setRefreshing(true);
    try {
      // 1. Fetch certificates list
      const resCerts = await fetch("/api/admin/certificates", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!resCerts.ok) throw new Error("Error cargando certificados.");
      const listCerts = await resCerts.json();
      setCerts(listCerts);

      // 2. Fetch admin stats
      const resStats = await fetch("/api/admin/dashboard-stats", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!resStats.ok) throw new Error("Error cargando estadísticas.");
      const dataStats = await resStats.json();
      setStats({
        certificatesCount: dataStats.certificatesCount || 0,
        visitCount: dataStats.visitCount || 0
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage("No se pudo conectar con el servidor para recabar los datos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [token]);

  // Handle PDF file selection and converting to base64
  const handleFileProcess = (file: File) => {
    if (file.type !== "application/pdf") {
      alert("Solo se admite formato PDF oficial.");
      return;
    }
    // Limit to 10MB to be extremely safe with json payload limits
    if (file.size > 10 * 1024 * 1024) {
      alert("El archivo PDF supera el límite máximo de 10 megabytes.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const resultString = reader.result as string;
      // Extract raw base64 body after prefix comma
      const base64Body = resultString.split(",")[1];
      setPdfData(base64Body);
      setPdfFileName(file.name);
    };
    reader.onerror = () => {
      alert("Error leyendo el archivo.");
    };
    reader.readAsDataURL(file);
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const removeAttachedPdf = () => {
    setPdfData(null);
    setPdfFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setCurrentId("");
    setDocumentNumber("");
    setPdfData(null);
    setPdfFileName(null);
    setErrorMessage("");
    setFormOpen(true);
  };

  const openEditModal = (cert: Certificate & { hasPdf: boolean }) => {
    setIsEditing(true);
    setCurrentId(cert.id);
    setDocumentNumber(cert.documentNumber);
    setPdfFileName(cert.pdfFileName);
    // pdfData is not loaded initially in listings to save memory, we preserve it as current unless overwritten
    setPdfData(undefined as any); // undefined tells backend to keep previous
    setErrorMessage("");
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentNumber.trim()) {
      setErrorMessage("Por favor, ingrese el número de documento.");
      return;
    }
    if (!pdfData && !isEditing) {
      setErrorMessage("Por favor, cargue un archivo PDF del certificado.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    const payload = {
      documentNumber: documentNumber.trim(),
      pdfData: pdfData !== null ? pdfData : undefined,
      pdfFileName
    };

    try {
      const url = isEditing ? `/api/admin/certificates/${currentId}` : "/api/admin/certificates";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Fallo en la comunicación.");
      }

      setFormOpen(false);
      fetchAllData();
    } catch (err: any) {
      setErrorMessage(err.message || "Fallo al almacenar el certificado.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/certificates/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Fallo al eliminar.");
      setDeleteConfirmId(null);
      fetchAllData();
    } catch (err: any) {
      alert(err.message || "Error al eliminar.");
    }
  };

  const handleSignout = () => {
    signOut(auth).then(onLogout);
  };

  // Filter listings based on document number or pdf physical name search
  const filteredCerts = certs.filter(c => {
    const s = searchTerm.toLowerCase();
    return (
      c.documentNumber.toLowerCase().includes(s) ||
      (c.pdfFileName && c.pdfFileName.toLowerCase().includes(s))
    );
  });

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              Sistem<span className="text-indigo-600">Certi</span>
            </span>
            <span className="bg-slate-900 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded">
              Panel de Carga
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Asocie números de documento de identidad con sus respectivos archivos PDF para descarga inmediata.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Action */}
          <button
            onClick={fetchAllData}
            disabled={refreshing}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
            title="Recargar panel"
            id="btn-refresh-stats"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer shadow-sm transition"
            id="btn-add-certificate"
          >
            <Plus className="w-4 h-4" />
            <span>Cargar PDF</span>
          </button>

          <button
            onClick={handleSignout}
            className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition"
            id="btn-exit"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Main Stats Segment */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 font-mono text-sm">
          Cargando entorno administrativo del servidor...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    Certificados Totales
                  </span>
                  <h3 className="text-3xl font-black text-slate-900 mt-2 font-serif">
                    {stats.certificatesCount}
                  </h3>
                </div>
                <div className="bg-slate-100 text-slate-700 p-2.5 rounded-2xl animate-pulse">
                  <Award className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-4 font-mono">
                Archivos PDF indexados en base de datos
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    Descargas / Visitas del Portal
                  </span>
                  <h3 className="text-3xl font-black text-slate-900 mt-2 font-serif">
                    {stats.visitCount}
                  </h3>
                </div>
                <div className="bg-indigo-50 text-indigo-700 p-2.5 rounded-2xl">
                  <Database className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-4 font-mono">
                Consultas totales realizadas por graduados
              </p>
            </div>
          </div>

          {/* Table detail list */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-50/50">
              <span className="text-sm font-bold text-slate-800">
                Certificados Disponibles ({filteredCerts.length})
              </span>

              <div className="relative max-w-sm">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por cédula o nombre de archivo..."
                  className="w-full bg-white border border-slate-300 rounded-xl pr-3 pl-9 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              </div>
            </div>

            {filteredCerts.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-xs">
                No hay certificados que coincidan con la búsqueda. ¡Haga clic en "Cargar PDF" para registrar uno nuevo!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold border-b border-slate-200">
                      <th className="px-5 py-3.5 font-bold">Número de Documento</th>
                      <th className="px-5 py-3.5 font-bold">Archivo de Soporte (PDF)</th>
                      <th className="px-5 py-3.5 font-bold">Fecha de Registro</th>
                      <th className="px-5 py-3.5 text-right font-bold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredCerts.map((cert) => (
                      <tr key={cert.id} className="hover:bg-slate-50/40 transition">
                        <td className="px-5 py-4 font-bold text-slate-900 font-mono">
                          {cert.documentNumber}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          <div className="flex items-center gap-2 max-w-xs md:max-w-md">
                            <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                            <span className="truncate" title={cert.pdfFileName || ""}>
                              {cert.pdfFileName || "archivo.pdf"}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-400 text-[11px] font-mono">
                          {new Date(cert.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            {/* Download matching PDF */}
                            <button
                              onClick={() => window.open(`/api/public/certificates/${cert.id}/pdf`, "_blank")}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg cursor-pointer transition"
                              title="Ver / Descargar PDF"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Trigger edits modal */}
                            <button
                              onClick={() => openEditModal(cert)}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer transition"
                              title="Editar documento o re-cargar PDF"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Trigger deletes confirm */}
                            <button
                              onClick={() => setDeleteConfirmId(cert.id)}
                              className="p-1.5 hover:bg-red-50 text-red-400 hover:text-red-700 rounded-lg cursor-pointer transition"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* CREATE OR EDIT VIRTUAL DIALOG */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-300 w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold tracking-tight">
                  {isEditing ? "Modificar Registro" : "Cargar Certificado Simplificado"}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {isEditing ? "Edite el número de documento o suba un archivo nuevo" : "Ingrese el documento y suba el archivo de soporte"}
                </p>
              </div>
              <button 
                onClick={() => setFormOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {errorMessage && (
                <p className="bg-red-50 border border-red-100 text-red-600 px-4 py-2.5 rounded-xl text-xs font-semibold">
                  {errorMessage}
                </p>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Número de Documento de Identidad *
                </label>
                <input
                  type="text"
                  required
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Ej: 1085324521 o C.C. 52990112"
                  className="w-full bg-white text-slate-800 rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                />
              </div>

              {/* PDF UPLOAD DRAG AND DROP CONTAINER */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Archivo del Certificado (PDF) *
                </label>

                {pdfFileName ? (
                  <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 text-indigo-800 p-3.5 rounded-xl">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                      <span className="text-xs font-bold truncate pr-3">{pdfFileName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={removeAttachedPdf}
                      className="text-slate-500 hover:text-red-650 p-1 cursor-pointer transition0"
                      title="Quitar archivo cargado"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer select-none transition ${
                      isDragging 
                        ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                        : "border-slate-300 hover:border-indigo-400 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="application/pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileProcess(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                    <Upload className="w-8 h-8 mx-auto text-slate-400 mb-1.5" />
                    <p className="text-xs font-bold text-slate-700">Arrastre su PDF aquí o haga clic para cargarlo</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Límite: 10 MB</p>
                  </div>
                )}
                {isEditing && !pdfFileName && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    * Deje vacío si no desea reemplazar el archivo PDF actual.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs cursor-pointer transition shadow-sm animate-none"
                >
                  {submitting ? "Cargando..." : isEditing ? "Guardar cambios" : "Cargar certificado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODE */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-300 w-full max-w-sm p-6 shadow-2xl text-center">
            <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-extrabold text-slate-900">¿Desea borrar el certificado?</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto mb-6">
              Esta acción eliminará el registro y su archivo soporte PDF asociado de forma permanente.
            </p>
            <div className="flex gap-2.5 justify-center">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4.5 py-2 rounded-xl text-xs cursor-pointer transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="bg-red-650 bg-red-600 hover:bg-red-500 text-white font-bold px-4.5 py-2 rounded-xl text-xs cursor-pointer transition"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
