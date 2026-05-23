export interface Certificate {
  id: string;
  documentNumber: string;
  pdfData: string | null; // base64 string
  pdfFileName: string | null;
  createdAt: string; // ISO date
}

export interface Stats {
  visitCount: number;
}
