const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");

class Splitter {
  constructor(inputPdfPath, maxSize = 2 * 1024 * 1024, maxFiles = 9) {
    this.inputPdfPath = inputPdfPath;
    this.maxSize = maxSize;
    this.maxFiles = maxFiles;
    this.sessionId = uuidv4();
    this.tempDir = path.join(os.tmpdir(), `temp_pages_${this.sessionId}`);
    this.outputDir = path.join(__dirname, ".UAIL-123");
    fs.mkdirSync(this.tempDir, { recursive: true });
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  async getPdfPageSizeInBytes(pdfDoc, pageIndex) {
    const tempDoc = await PDFDocument.create();
    const [copiedPage] = await tempDoc.copyPages(pdfDoc, [pageIndex]);
    tempDoc.addPage(copiedPage);
    const pdfBytes = await tempDoc.save();
    return pdfBytes.length;
  }

  async savePdf(doc, index) {
    const saveName = path.basename(this.inputPdfPath, ".pdf");
    const fileName = `${saveName}_${index + 1}.pdf`;
    const filePath = path.join(this.outputDir, fileName);
    const pdfBytes = await doc.save();
    fs.writeFileSync(filePath, pdfBytes);
    return filePath;
  }

  cleanupTemp() {
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    }
  }

  cleanupResults(files) {
    for (const file of files) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
  }

  async splitPdf() {
    const outputFiles = [];
    try {
      const inputBuffer = fs.readFileSync(this.inputPdfPath);
      const pdfDoc = await PDFDocument.load(inputBuffer);

      let currentWriter = await PDFDocument.create();
      let currentSize = 0;
      let index = 0;

      for (let i = 0; i < pdfDoc.getPageCount(); i++) {
        const pageSize = await this.getPdfPageSizeInBytes(pdfDoc, i);

        if (pageSize > this.maxSize) {
          throw new Error(`Page ${i + 1} exceeds maximum size limit.`);
        }

        if (currentSize + pageSize > this.maxSize) {
          outputFiles.push(await this.savePdf(currentWriter, index));
          if (outputFiles.length > this.maxFiles) {
            throw new Error("Exceeded the maximum number of output files.");
          }
          currentWriter = await PDFDocument.create();
          currentSize = 0;
          index++;
        }

        const [copiedPage] = await currentWriter.copyPages(pdfDoc, [i]);
        currentWriter.addPage(copiedPage);
        currentSize += pageSize;
      }

      if (currentWriter.getPageCount() > 0) {
        outputFiles.push(await this.savePdf(currentWriter, index));
      }

      if (outputFiles.length > this.maxFiles) {
        throw new Error("Exceeded the maximum number of output files.");
      }

      return outputFiles;
    } catch (error) {
      this.cleanupResults(outputFiles);
      return null;
    } finally {
      this.cleanupTemp();
    }
  }
}

module.exports = { Splitter };
