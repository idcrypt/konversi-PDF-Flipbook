const uploadInput = document.getElementById("pdf-upload");
const container = document.getElementById("flipbook-container");

// pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js';

uploadInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const fileReader = new FileReader();
  fileReader.onload = async function() {
    const typedarray = new Uint8Array(this.result);
    const pdf = await pdfjsLib.getDocument(typedarray).promise;

    container.innerHTML = ""; // reset
    const pageImages = [];

    // Render pages lazy (one by one)
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
      pageImages.push(canvas.toDataURL());
    }

    // Create flipbook
    const flipbook = new St.PageFlip(container, {
      width: 600,
      height: 500,
      size: "stretch",
      maxShadowOpacity: 0.5,
      showCover: true
    });
    flipbook.loadFromImages(pageImages);
  };

  fileReader.readAsArrayBuffer(file);
});
