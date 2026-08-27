declare module "html2pdf.js" {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: { type?: string; quality?: number };
    enableLinks?: boolean;
    html2canvas?: Record<string, unknown>;
    jsPDF?: Record<string, unknown>;
    pagebreak?: {
      mode?: string | string[] | unknown[];
      before?: string[];
      after?: string[];
      avoid?: string[];
    };
  }

  interface Html2PdfWorker {
    set(options: Html2PdfOptions): Html2PdfWorker;
    from(element: HTMLElement): Html2PdfWorker;
    toCanvas(): Html2PdfWorker;
    get(key: "canvas"): Promise<HTMLCanvasElement>;
    get(key: string): Promise<unknown>;
    save(): Promise<void>;
    outputPdf(type: "blob"): Promise<Blob>;
    outputPdf(type: string): Promise<unknown>;
  }

  function html2pdf(): Html2PdfWorker;
  export default html2pdf;
}
