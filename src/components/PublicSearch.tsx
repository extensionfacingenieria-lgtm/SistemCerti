import React, { useState, useEffect } from "react";
import { Certificate } from "../types";
import { Search, Award, FileText, Download, UserCheck, Sparkles } from "lucide-react";

interface PublicSearchProps {
  onSelectPrint?: (cert: Certificate) => void;
  onAdminClick: () => void;
}

export default function PublicSearch({ onAdminClick }: PublicSearchProps) {
  const [docNumber, setDocNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<(Certificate & { hasPdf: boolean })[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ visitCount: 0, certificatesCount: 0 });

  // Increment visit counter once upon rendering the public page
  useEffect(() => {
    // Post to register the visit
    fetch("/api/public/visit", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.visitCount !== undefined) {
          setStats((prev) => ({ ...prev, visitCount: data.visitCount }));
        }
      })
      .catch((err) => console.error("Error setting stats:", err));

    // Fetch total certificates and updated visits
    fetch("/api/public/stats-view")
      .then((res) => res.json())
      .then((data) => {
        setStats({
          visitCount: data.visitCount || 0,
          certificatesCount: data.certificatesCount || 0
        });
      })
      .catch((err) => console.error("Error viewing statistics:", err));
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docNumber.trim()) {
      setError("Por favor, ingrese su número de documento.");
      return;
    }

    setLoading(true);
    setError("");
    setSearched(true);

    try {
      const response = await fetch(`/api/public/certificates/${encodeURIComponent(docNumber.trim())}`);
      if (!response.ok) {
        throw new Error("Error al consultar el servidor.");
      }
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError("No se pudieron buscar los certificados. Intente de nuevo más tarde.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = (certId: string) => {
    window.open(`/api/public/certificates/${certId}/pdf`, "_blank");
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      {/* Mini Branding header */}
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 text-white p-2 rounded-xl">
            <Award className="w-6 h-6 text-indigo-400" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-slate-900 font-sans">
            Sistem<span className="text-indigo-600">Certi</span>
          </span>
        </div>
        <button
          onClick={onAdminClick}
          className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg cursor-pointer transition border border-slate-200"
          id="btn-admin-access"
        >
          Acceso Administrador
        </button>
      </div>

      {/* Hero presentation with search bar */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-wider">
          Consulta Oficial
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mt-4 leading-normal">
          Descarga tus Certificados PDF
        </h1>
        <p className="text-slate-600 mt-3 text-sm">
          Ingresa tu número de documento de identidad para buscar y descargar tus archivos de certificación oficial de forma inmediata e independiente.
        </p>

        {/* Search Input Frame */}
        <form onSubmit={handleSearch} className="mt-8 relative max-w-lg mx-auto" id="search-form">
          <div className="relative">
            <input
              type="text"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              placeholder="Ej: 1085324521"
              className="w-full bg-white text-slate-800 rounded-2xl border-2 border-slate-200 pl-12 pr-28 py-4 font-semibold text-lg shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
              id="txt-document-number"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition"
              id="btn-search-trigger"
            >
              {loading ? "Buscando..." : "Consultar"}
            </button>
          </div>
          {error && <p className="text-red-600 text-left text-xs font-semibold mt-2">{error}</p>}
        </form>
      </div>

      {/* Verification indicators */}
      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-12 text-center">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center">
          <Award className="w-8 h-8 text-indigo-600 mb-1" />
          <span className="text-2xl font-bold font-mono text-slate-800">
            {stats.certificatesCount}
          </span>
          <span className="text-xs text-slate-500 font-medium leading-none mt-1">
            Certificados PDF Listos
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center">
          <UserCheck className="w-8 h-8 text-indigo-600 mb-1" />
          <span className="text-2xl font-bold font-mono text-slate-800">
            {stats.visitCount}
          </span>
          <span className="text-xs text-slate-500 font-medium leading-none mt-1">
            Consultas Realizadas
          </span>
        </div>
      </div>

      {/* Search results rendering block */}
      {searched && (
        <div className="mt-8 transition-all max-w-2xl mx-auto">
          <h2 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">
            Resultados de búsqueda ({results.length})
          </h2>

          {results.length === 0 ? (
            <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-8 text-center" id="no-results-frame">
              <Sparkles className="w-12 h-12 text-amber-500 mx-auto mb-2" />
              <h3 className="font-bold text-slate-800">No se encontraron registros</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                No hay certificados disponibles vinculados al documento <strong>{docNumber}</strong>. Verifique el número ingresado o comuníquese con la administración para que lo cargue.
              </p>
            </div>
          ) : (
            <div className="grid gap-4" id="results-item-list">
              {results.map((cert) => (
                <div
                  key={cert.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded">
                      Documento: {cert.documentNumber}
                    </span>
                    <h3 className="text-sm font-bold text-slate-800 mt-2 truncate flex items-center gap-1.5" title={cert.pdfFileName || ""}>
                      <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <span className="truncate">{cert.pdfFileName || "Certificado Oficial.pdf"}</span>
                    </h3>
                    <p className="text-[10px] text-slate-450 text-slate-400 mt-1 font-mono">
                      Cargado el: {new Date(cert.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div>
                    <button
                      onClick={() => handleDownloadPdf(cert.id)}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer transition"
                      title="Descargar archivo PDF cargado por el tutor"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar PDF</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
