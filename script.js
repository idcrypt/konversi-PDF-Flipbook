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

    container.innerHTML = ""; 
    pageImages = Array(pdf.numPages).fill(null); 

    const flipbook = new St.PageFlip(container, {
      width: 600,
      height: 500,
      size: "stretch",
      maxShadowOpacity: 0.5,
      showCover: true,
      startPage: 0
    });

    const loadPage = async (pageNum) => {
      if (pageImages[pageNum]) return; 
      const page = await pdf.getPage(pageNum + 1);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
      pageImages[pageNum] = canvas.toDataURL();
      flipbook.updatePage(pageNum, pageImages[pageNum]);
    };

    await loadPage(0);

    flipbook.on("flip", async (e) => {
      const pageIndex = e.data;
      await loadPage(pageIndex);
    });

    downloadBtn.disabled = false;
  };

  fileReader.readAsArrayBuffer(file);
});

downloadBtn.addEventListener("click", () => {
  const zip = new JSZip();
  const flipbookFolder = zip.folder("flipbook");
  const jsFolder = flipbookFolder.folder("js");
  const pagesFolder = flipbookFolder.folder("pages");

  fetch("https://unpkg.com/st-pageflip/dist/js/pageflip.min.js")
    .then(res => res.text())
    .then(jsContent => {
      jsFolder.file("pageflip.min.js", jsContent);
      flipbookFolder.file("style.css", `body{margin:0;font-family:Arial,sans-serif}#flipbook-container{width:100%;height:500px}`);

      pageImages.forEach((img, idx) => {
        if(img){
          const base64Data = img.split(',')[1];
          pagesFolder.file(`page${idx+1}.png`, base64Data, {base64: true});
        }
      });

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
          const images = [${pageImages.map((img, i) => img ? `'pages/page${i+1}.png'` : 'null').join(",")}];
          const container = document.getElementById("flipbook-container");
          const flipbook = new St.PageFlip(container, { width:600, height:500, size:"stretch", maxShadowOpacity:0.5, showCover:true });
          flipbook.loadFromImages(images.filter(img => img !== null));
        </script>
      </body>
      </html>
      `;
      flipbookFolder.file("index.html", indexHTML);

      zip.generateAsync({type:"blob"}).then(blob => {
        saveAs(blob, "flipbook.zip");
      });
    });
});
