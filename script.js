const uploadInput = document.getElementById("pdf-upload");
const container = document.getElementById("flipbook-container");
const downloadBtn = document.getElementById("download-btn");

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js';

let pageImages = [];

uploadInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const fileReader = new FileReader();
  fileReader.onload = async function() {
    const typedarray = new Uint8Array(this.result);
    const pdf = await pdfjsLib.getDocument(typedarray).promise;

    container.innerHTML = ""; // reset
    pageImages = [];

    // Render pages lazy (satu-satu)
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

    downloadBtn.disabled = false;
  };

  fileReader.readAsArrayBuffer(file);
});

// Export flipbook offline as ZIP
downloadBtn.addEventListener("click", () => {
  const zip = new JSZip();
  const flipbookFolder = zip.folder("flipbook");
  const jsFolder = flipbookFolder.folder("js");
  const pagesFolder = flipbookFolder.folder("pages");

  // Copy JS and CSS (StPageFlip & minimal CSS)
  fetch("https://unpkg.com/st-pageflip/dist/js/pageflip.min.js")
    .then(res => res.text())
    .then(jsContent => {
      jsFolder.file("pageflip.min.js", jsContent);
      flipbookFolder.file("style.css", `body{margin:0;font-family:Arial,sans-serif}#flipbook-container{width:100%;height:500px}`)

      // Save images
      pageImages.forEach((img, idx) => {
        const base64Data = img.split(',')[1];
        pagesFolder.file(`page${idx+1}.png`, base64Data, {base64: true});
      });

      // Create index.html inside ZIP
      let indexHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Offline Flipbook</title>
        <link rel="stylesheet" href="style.css">
        <script src="js/pageflip.min.js"></script>
      </head>
      <body>
        <div id="flipbook-container"></div>
        <script>
          const images = [${pageImages.map((_, i)=>`'pages/page${i+1}.png'`).join(",")}];
          const container = document.getElementById("flipbook-container");
          const flipbook = new St.PageFlip(container, { width:600, height:500, size:"stretch", maxShadowOpacity:0.5, showCover:true });
          flipbook.loadFromImages(images);
        </script>
      </body>
      </html>
      `;
      flipbookFolder.file("index.html", indexHTML);

      // Generate ZIP
      zip.generateAsync({type:"blob"}).then(blob => {
        saveAs(blob, "flipbook.zip");
      });
    });
});
