const { chromium } = require("playwright");
const ipc = require('electron').ipcRenderer;

async function uploadFiles(page, filePath) {
  // Extract the filename from the file path
  const filename = path.basename(filePath[0]);

  // Match the filename against the pattern
  const match = filename.match(/^(\d{12})-(\d{18})(?:\.\d+)?\.pdf$/);

  // Check if match was found
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
  await page.waitForTimeout(1000000);

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
  await page.waitForTimeout(1000000);

  let swalTextContent1 = await page.textContent(".swal-text");

  if (swalTextContent1.trim() != "Nomor agenda dengan idpel cocok") {
    console.log(`[!] ${idpel} / ${idag}:`, swalTextContent1.trim());
    return false;
  } else {
    await page.click(".swal-button.swal-button--confirm");
  }

  let fixedFileBelt = [];

  while (fixedFileBelt.length < 13) {
    fixedFileBelt.push(...filePath);
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
  await page.waitForTimeout(1000000);
  swalTextContent = await page.textContent(".swal-text");

  console.log(`[i] ${idpel} / ${idag}:`, swalTextContent);

  await page.waitForSelector(".swal-button.swal-button--confirm", {
    timeout: 1000000,
  });
  await page.click(".swal-button.swal-button--confirm");

  return true;
}

module.exports = { uploadFiles };

(async () => {
  try {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    browser.on("disconnected", () => {
      process.exit(0);
    });

    await page.goto(config.url);

    // Login Section

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
      ipc.send('login-failed', config.username); 
      await browser.close();
      process.exit(1);
    } catch (error) {}

    // Navigating to transaction page
    ipc.send('login-success', config.username); 
    await page.click("[href='/transaksi-ail']");
    await page.click('button:has-text("Tambah Transaksi Baru")');

    // uploading files
    const keys = Object.keys(fixedUpload);
    for (let i = 0; i < keys.length; i++) {
      let uploaded = await uploadFiles(page, fixedUpload[keys[i]]);
      await page.reload();
      if (uploaded) {
        const sourceFilePath = keys[i];
        const fileName = path.basename(sourceFilePath);
        const destinationPath = path.join(doneFolder, "upload", fileName);

        fs.rename(sourceFilePath, destinationPath, (err) => {
          if (err) {
            if (err.code === "EXDEV") {
              fs.copyFile(sourceFilePath, destinationPath, (copyErr) => {
                if (copyErr) {
                  console.error("[!] Gagal memindahkan berkas:", copyErr);
                  return;
                }
                fs.unlink(sourceFilePath, (unlinkErr) => {
                  if (unlinkErr) {
                    console.error("[!] Gagal memindahkan berkas:", unlinkErr);
                  }
                });
              });
            } else {
              console.error("[!] Gagal memindahkan berkas:", err);
            }
          }
        });
        await page.click('button:has-text("Tambah Transaksi Baru")');
      }
    }
    await browser.close();
  } catch (error) {
    console.error(
      "[!] Terjadi kesalahan pada pengunggah. Mohon periksa koneksi internet, jika masalah masih berlanjut mohon hubungi pengembang"
    );
    console.log(error);
    process.exit(1);
  }
})();
