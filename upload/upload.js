const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { Splitter } = require("./splitter");
const config = require("./config.json");

let fileQueue = []; // Object antrian untuk menyimpan file yang akan diunggah
let isProcessing = false; // Flag untuk memeriksa apakah sedang memproses file
const watchedFolder = path.join(config.done, "rename");

// Fungsi untuk menambahkan file PDF yang ada di folder ke dalam antrian
function addFilesToQueue() {
  fs.readdir(watchedFolder, (err, files) => {
    if (err) {
      console.error("[!] Error membaca folder:", err);
      return;
    }

    files.forEach((file) => {
      const filePath = path.join(watchedFolder, file);
      if (fs.existsSync(filePath) && filePath.endsWith(".pdf")) {
        // Menambahkan file PDF ke antrian
        fileQueue.push(filePath);
        console.log(`[i] File ${file} ditambahkan ke antrian.`);
      }
    });
  });
}

async function deleteFilesSync(filePaths) {
  try {
    filePaths.forEach((filePath) => {
      fs.unlinkSync(filePath); // Menghapus file secara sinkron
    });
  } catch {}
}

// Fungsi untuk memantau perubahan folder dan menambahkan file baru ke dalam antrian
function watchFolderForNewFiles() {
  fs.watch(watchedFolder, (eventType, filename) => {
    if (eventType === "rename" && filename && filename.endsWith(".pdf")) {
      const filePath = path.join(watchedFolder, filename);
      if (fs.existsSync(filePath)) {
        // Menambahkan file yang baru ditambahkan ke antrian
        fileQueue.push(filePath);
        console.log(`[i] File baru ${filename} ditambahkan ke antrian.`);
      }
    }
  });
}

// Fungsi untuk mengupload file
async function uploadFiles(page, filePaths, filename) {
  const filename = path.basename(filename);
  const match = filename.match(/^(\d{12})-(\d{18})(?:\.\d+)?\.pdf$/);

  if (!match) {
    console.error(
      `[!] Error: Filename ${filename} does not match the expected pattern.`
    );
    return false;
  }

  const [idpel, idag] = match.slice(1);

  if (!idpel) {
    console.error("[!] Error: ID Pelanggan not found.");
    return false;
  }

  await page.click("[placeholder='Jenis Transaksi']");
  await page.click('li:has-text("PASANG BARU")');

  await page.fill('input[placeholder="ID Pelanggan"]', idpel);
  await page.click(
    "body > div.app > div > main > div > div > div > span > form > div.row.mt-3 > div > span > div > button"
  );

  await page.waitForSelector(".swal-button.swal-button--confirm", {
    timeout: 1000000,
  });
  await page.waitForSelector(".swal-overlay.swal-overlay--show-modal", {
    timeout: 1000000,
  });

  let swalTextContent0 = await page.textContent(".swal-text");

  if (swalTextContent0.trim() != "Pelanggan berhasil ditemukan!") {
    console.log(`[!] ${idpel} / ${idag}:`, swalTextContent0.trim());
    return false;
  }

  await page.click(".swal-button.swal-button--confirm");

  await page.fill('input[placeholder="Nomor Agenda"]', idag);

  await page.click(
    "body > div.app > div > main > div > div > div > span > form > div.row.mt-4 > div > div > button"
  );

  await page.waitForSelector(".swal-overlay.swal-overlay--show-modal", {
    timeout: 1000000,
  });

  let swalTextContent1 = await page.textContent(".swal-text");

  if (swalTextContent1.trim() != "Nomor agenda dengan idpel cocok") {
    console.log(`[!] ${idpel} / ${idag}:`, swalTextContent1.trim());
    return false;
  } else {
    await page.click(".swal-button.swal-button--confirm");
  }

  let fixedFileBelt = [];

  while (fixedFileBelt.length < 32) {
    fixedFileBelt.push(...[filePaths]);
  }

  const pdfInputs = await page.$$('input[accept="application/pdf"]');

  let iteration = 0;
  for (const input of pdfInputs) {
    await input.setInputFiles(fixedFileBelt[iteration]);
    iteration++;
  }

  const allViewBtn = await page.$$(".btn.ml-3.btn-info");
  for (const btn of allViewBtn) {
    await btn.click();
    await page.click(".close");
  }

  await page.click(".btn.btn-success");

  await page.waitForSelector(".swal-button.swal-button--confirm", {
    timeout: 1000000,
  });
  await page.click(".swal-button.swal-button--confirm");

  await page.waitForSelector(".swal-overlay.swal-overlay--show-modal", {
    timeout: 1000000,
  });

  swalTextContent = await page.textContent(".swal-text");
  console.log(`[i] ${idpel} / ${idag}:`, swalTextContent);

  await page.waitForSelector(".swal-button.swal-button--confirm", {
    timeout: 1000000,
  });
  await page.click(".swal-button.swal-button--confirm");

  return true;
}

// Fungsi utama yang menjalankan login dan mengelola antrian file
(async () => {
  try {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // Login dengan Playwright
    await page.goto(config.url);

    await page.waitForSelector("#captcha", { timeout: 1000000 });

    const captchaDetails = await page.evaluate(() => {
      const captchaElement = document.querySelector("#captcha");
      return captchaElement
        ? {
            value: captchaElement.value,
            attributes: Array.from(captchaElement.attributes).map((attr) => ({
              name: attr.name,
              value: attr.value,
            })),
          }
        : null;
    });

    await page.fill('input[placeholder="Username"]', config.username);
    await page.fill('input[placeholder="Password"]', config.password);
    await page.fill(
      "input.form-control.form-control:not([placeholder]):not(#captcha)[id]",
      captchaDetails.value
    );
    await page.click('button:has-text("Login")');

    try {
      await page.waitForSelector(".swal-text", { timeout: 5000 });
      console.error("[!] Error: Username atau password salah.");
      await browser.close();
      process.exit(1);
    } catch (error) {}

    // Menambahkan file PDF yang ada di folder ke dalam antrian
    addFilesToQueue();

    // Memantau perubahan di folder dan menambahkannya ke antrian
    watchFolderForNewFiles();

    // Loop terus-menerus untuk mengecek dan mengunggah file dalam antrian
    await page.click("[href='/transaksi-ail']");
    await page.click('button:has-text("Tambah Transaksi Baru")');
    while (true) {
      if (fileQueue.length > 0 && !isProcessing) {
        isProcessing = true;
        const filePath = fileQueue.shift(); // Ambil file pertama dari antrian
        let uploaded = false;

        const splitter = new Splitter(filePath);
        const result = await splitter.splitPdf();

        if (result) {
          try {
            uploaded = await uploadFiles(page, result, filePath);
          } catch {}

          await page.reload();

          if (uploaded) {
            await page.click("[href='/transaksi-ail']");
            await page.click('button:has-text("Tambah Transaksi Baru")');
            const fileName = path.basename(filePath);
            const destinationPath = path.join(config.done, "upload", fileName);

            fs.rename(filePath, destinationPath, (err) => {
              if (err) {
                console.error("[!] Gagal memindahkan berkas:", err);
              }
            });
          }

          deleteFilesSync(result);
        }
        isProcessing = false;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error(
      "[!] Terjadi kesalahan pada pengunggah. Mohon periksa koneksi internet, jika masalah masih berlanjut mohon hubungi pengembang"
    );
    console.log(error);
    process.exit(1);
  }
})();
