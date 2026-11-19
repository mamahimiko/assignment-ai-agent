export async function readPdf(buffer: ArrayBuffer): Promise<{ text: string; pages: number }> {
  const pdfjs = await import("pdfjs-dist");
  // Bundle worker, Japanese character maps and standard fonts with the app.
  // This avoids CDN/network dependencies during the presentation.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/" });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const extract = async () => {
    const pdf = await task.promise;
    if (pdf.numPages > 100) throw new Error("Please split PDFs longer than 100 pages.");
    const texts: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      texts.push(`[Page ${p}]\n${content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("")}`);
    }
    return { text: texts.join("\n\n"), pages: pdf.numPages };
  };
  try {
    return await Promise.race([extract(), new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error("PDF reading timed out. Try a smaller, unlocked PDF.")), 20000);
    })]);
  } finally {
    clearTimeout(timeout);
    void task.destroy().catch(() => {});
  }
}
export async function demoPdf(name: string, text: string): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  pdf.setFontSize(11);
  pdf.text("DEMO DATA - fictional document, not for filing", 18, 20);
  pdf.setFontSize(16);
  pdf.text("Sample financial document", 18, 40);
  pdf.setFontSize(11);
  pdf.text(pdf.splitTextToSize(text.replace(/[^\x20-\x7E\n]/g, ""), 170), 18, 60);
  return URL.createObjectURL(pdf.output("blob"));
}
// UTF-8 preserves Japanese and Swedish names without relying on embedded PDF fonts.
export async function downloadReport(text: string) {
  const url = URL.createObjectURL(new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "sumitt-draft-report.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Render the entire document so a mixed text/scanned PDF cannot silently lose pages.
export async function renderPdfForAi(buffer: ArrayBuffer): Promise<{page:number;image:string}[]> {
  const pdfjs=await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc='/pdfjs/pdf.worker.min.mjs';
  const task=pdfjs.getDocument({data:new Uint8Array(buffer),cMapUrl:'/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdfjs/standard_fonts/',wasmUrl:'/pdfjs/wasm/'});
  let timer:ReturnType<typeof setTimeout>|undefined;
  const work=async()=>{
    const pdf=await task.promise;
    if(pdf.numPages>5)throw new Error('too_many_pages');
    const result:{page:number;image:string}[]=[];let size=0;
    for(let n=1;n<=pdf.numPages;n++){
      const page=await pdf.getPage(n);const base=page.getViewport({scale:1});
      const viewport=page.getViewport({scale:Math.min(2.5,1800/Math.max(base.width,base.height))});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      try{
        const ctx=canvas.getContext('2d');if(!ctx)throw new Error('image_too_large');
        await page.render({canvasContext:ctx,canvas,viewport,background:'rgb(255,255,255)'}).promise;
        const budget=Math.floor(3500000/pdf.numPages);
        let image=canvas.toDataURL('image/jpeg',0.87);
        for(const quality of [0.72,0.55,0.4]){if(image.length<=budget)break;image=canvas.toDataURL('image/jpeg',quality);}
        size+=image.length;
        if(image.length>budget||size>3500000)throw new Error('image_too_large');
        result.push({page:n,image});
      }finally{canvas.width=0;canvas.height=0;page.cleanup();}
    }
    return result;
  };
  try{return await Promise.race([work(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),30000);})]);}
  finally{clearTimeout(timer);void task.destroy().catch(()=>{});}
}
