// requirements
const fs = require("fs");
const path = require("path");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const axios = require("axios");
const glob = require("glob");
const { URL } = require("url");
const FormData = require("form-data");

// definisi konstanta
const CONFIG_PATH = path.join(__dirname, "config.json");

// definisi fungsi
const readConfig = () => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    }
    return {};
  } catch (error) {
    return {};
  }
};

const writeConfig = (config) => {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
};

const normalizeUrl = (url) => {
  if (!url) {
    return "";
  }
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.href.replace(/\/$/, "");
  } catch (error) {
    return "";
  }
};

const isValidUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
};

// kode utama
const argv = yargs(hideBin(process.argv))
  .option("upload", {
    describe: "Filepath berkas yang akan direname & diunggah",
    type: "boolean",
    conflicts: "rename",
  })
  .option("rename", {
    describe: "Filepath berkas yang akan direname",
    type: "boolean",
    conflicts: "upload",
  })
  .option("url", {
    describe: "Definisikan URL situs web",
    type: "string",
  })
  .option("repo", {
    describe: "Definisikan URL repository pengunggah",
    type: "string",
  })
  .option("apikey", {
    describe: "Definisikan API Key untuk autentikasi pengunggah",
    type: "string",
  })
  .option("api", {
    describe: "Definisikan API OCR & pemecah PDF",
    type: "string",
  })
  .option("username", {
    alias: "user",
    describe: "Definisikan Username untuk autentikasi",
    type: "string",
  })
  .option("password", {
    alias: "pass",
    describe: "Definisikan Password untuk autentikasi",
    type: "string",
  })
  .option("done", {
    describe: "Definisikan folder penyimpan berkas terproses",
    type: "string",
  })
  .check((argv) => {
    const hasOtherOptions =
      argv.url ||
      argv.repo ||
      argv.apikey ||
      argv.api ||
      argv.username ||
      argv.password ||
      argv.done;

    if (!argv.upload && !argv.rename && !hasOtherOptions) {
      throw new Error(
        "Anda harus memilih salah satu antara --upload atau --rename."
      );
    }
    return true;
  }).argv;

let config = readConfig();

config.url = normalizeUrl(argv.url || config.url);
config.repo = normalizeUrl(argv.repo || config.repo);
config.api = normalizeUrl(argv.api || config.api);
config.apikey = argv.apikey || config.apikey;
config.username = argv.username || config.username;
config.password = argv.password || config.password;

if (argv.done) {
  config.done = path.isAbsolute(argv.done)
    ? argv.done
    : path.join(process.cwd(), argv.done);
} else {
  config.done = config.done;
}

writeConfig(config);

const undefined_errors = [];
const defined_errors = [];

if (!config.url) undefined_errors.push("URL arsip induk");
else if (!isValidUrl(config.url)) defined_errors.push("URL arsip induk");

if (!config.repo) undefined_errors.push("URL repository");
else if (!isValidUrl(config.repo)) defined_errors.push("URL repository");

if (!config.api) undefined_errors.push("URL API");
else if (!isValidUrl(config.api)) defined_errors.push("URL API");

if (!config.apikey) undefined_errors.push("apikey");
else if (typeof config.apikey !== "string" || config.apikey.length < 1)
  defined_errors.push("apikey");

if (!config.username) undefined_errors.push("username");
else if (typeof config.username !== "string" || config.username.length < 1)
  defined_errors.push("username");

if (!config.password) undefined_errors.push("password");
else if (typeof config.password !== "string" || config.password.length < 1)
  defined_errors.push("password");

if (!config.done) undefined_errors.push("folder berkas terproses");
else {
  try {
    if (!fs.existsSync(config.done)) {
      fs.mkdirSync(config.done, { recursive: true });
    }
    fs.accessSync(config.done, fs.constants.W_OK);
  } catch (error) {
    defined_errors.push("folder berkas terproses");
  }
}

if (undefined_errors.length > 0) {
  console.warn(
    "[!] Error:",
    undefined_errors.join(", "),
    "harus didefinisikan terlebih dahulu."
  );
  process.exit(1);
}

if (defined_errors.length > 0) {
  console.warn("[!] Error:", defined_errors.join(", "), "tidak valid.");
  process.exit(1);
}

let filesArray = [];

try {
  argv._.forEach(() => {
    const resolvedPath = path.resolve(filePath);

    if (fs.existsSync(resolvedPath) && fs.lstatSync(resolvedPath).isFile()) {
      // Periksa apakah ini file PDF
      if (path.extname(resolvedPath).toLowerCase() === ".pdf") {
        filesArray.push(resolvedPath);
      } else {
        console.warn(`[!] Error: Bukan merupakan file PDF - ${resolvedPath}`);
        process.exit(1);
      }
    } else {
      // Jika bukan file yang valid, gunakan filePath sebagai pola glob
      const pattern = path.join(resolvedPath);
      const matchedFiles = glob.sync(pattern.replace(/\\/g, "/"), { absolute: true });

      // Filter hasil glob untuk mendapatkan file PDF yang valid
      const pdfFiles = matchedFiles.filter((file) =>
        fs.existsSync(file) &&
        fs.lstatSync(file).isFile() &&
        path.extname(file).toLowerCase() === ".pdf"
      );

      if (pdfFiles.length > 0) {
        pdfFiles.forEach((pdfFile) => filesArray.push(pdfFile));
      } else {
        console.warn(
          `[!] Error: Tidak ada file PDF yang ditemukan untuk pola - ${pattern.replace(/\\/g, "/")}`
        );
      }
    }
  });

} catch (error) {
  console.warn("[!] Error:", error.message);
  process.exit(1);
}

const doneFolder = config.done;
const renameFolder = path.join(doneFolder, "rename");
const uploadFolder = path.join(doneFolder, "upload");
const tempFolder = path.join(doneFolder, ".temp");

if (!fs.existsSync(doneFolder)) {
  fs.mkdirSync(doneFolder, { recursive: true });
}

if (!fs.existsSync(renameFolder)) {
  fs.mkdirSync(renameFolder, { recursive: true });
}

if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}

if (!fs.existsSync(tempFolder)) {
  fs.mkdirSync(tempFolder, { recursive: true });
}

let fixedUpload = {};

(async (filesArray) => {
  for (const filePath of filesArray) {
    const fileName = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;
    let uploadedFiles = [];  // Ini adalah array yang akan diisi dengan berkas yang berhasil diunggah.
    const filePattern = /^[0-9]{12}-[0-9]{18}\.pdf$/;

    // Cek apakah berkas harus diupload atau tidak
    if (argv.upload && !filePattern.test(fileName)) {
      console.log(
        "[i] Berkas",
        fileName,
        "dilewati karena nama berkas tidak sesuai"
      );
      continue;
    }

    // Proses rename jika berkas cocok dengan pola
    if (argv.rename && filePattern.test(fileName)) {
      const destPath = path.join(renameFolder, fileName);
      fs.renameSync(filePath, destPath);
    } else if (argv.rename || (argv.upload && fileSize > 2 * 1024 * 1024)) {
      try {
        const firstFormData = new FormData();
        firstFormData.append("apikey", config.apikey);
        firstFormData.append(argv.rename ? "rename" : "split", "1");
        firstFormData.append("file", fs.createReadStream(filePath));

        const response = await axios.post(
          `${config.api}/uail/process`,
          firstFormData,
          {
            headers: {
              ...firstFormData.getHeaders(),
            },
          }
        );

        if (
          response.data &&
          (Array.isArray(response.data.files) || response.data.filename)
        ) {
          // Rename file jika perlu
          if (argv.rename) {
            const newFileName = response.data.filename + ".pdf";
            const destPath = path.join(renameFolder, newFileName);
            fs.renameSync(filePath, destPath);
          }

          // Proses upload jika ada
          if (argv.upload) {
            uploadedFiles = []; // Mengosongkan array untuk menampung berkas yang diunggah
            for (const resultFile of response.data.files) {
              const fileUrl = `${config.api}${resultFile}`;
              const destPath = path.join(tempFolder, path.basename(fileUrl));
              const writer = fs.createWriteStream(destPath);

              const secondFormData = new FormData();
              secondFormData.append("apikey", config.apikey);

              try {
                const downloadResponse = await axios.post(
                  fileUrl,
                  secondFormData,
                  {
                    responseType: "stream",
                    headers: {
                      ...secondFormData.getHeaders(),
                    },
                  }
                );

                // Menyimpan hasil unduhan ke dalam berkas
                downloadResponse.data.pipe(writer);

                await new Promise((resolve, reject) => {
                  writer.on("finish", () => {
                    uploadedFiles.push(destPath); // Menambahkan jalur berkas ke dalam array
                    resolve();
                  });
                  writer.on("error", reject);
                });
              } catch (error) {
                console.warn(
                  `[!] Gagal mengunduh berkas ${path.basename(filePath).slice(0, 31)} (akan dilewati)`
                );
                uploadedFiles.forEach((uploadedFilePath) => {
                  try {
                    fs.unlinkSync(uploadedFilePath);
                  } catch (unlinkError) { }
                });
                uploadedFiles = []; // Reset uploadedFiles jika ada kegagalan
                break;
              }
            }

            // Jika tidak ada berkas yang diunggah, lewati berkas ini
            if (uploadedFiles.length === 0) {
              continue;
            }
          }
        } else {
          console.warn(
            "[!] Error: Respon dari server berbeda dari yang diharapkan. Mohon hubungi pengembang."
          );
        }
      } catch (error) {
        // Menangani error dari server atau kesalahan lain
        if (error.response && error.response.data && error.response.data.error) {
          if (error.response.data.error.includes("ID Pelanggan")) {
            console.warn(`[!] ${error.response.data.error}:`, filePath);
            continue;
          }
          console.warn("[!] Error:", error.response.data.error);
        } else {
          console.log(error);
          console.warn("[!] Error:", error.message);
        }
        process.exit(1); // Keluar jika terjadi error
      }
    }

    // Menyimpan hasil unggahan ke dalam objek fixedUpload
    if (uploadedFiles.length > 0) {
      fixedUpload[filePath] = uploadedFiles; // Menambahkan entry untuk filePath dengan daftar berkas yang diunggah
    }
  }
  if (config.upload) {
    try {
      const filePath = path.join(__dirname, "repo", "uploader.js");

      // Membaca konten file secara sinkron
      fs.readFile(filePath, "utf-8", (err, repoCode) => {
        if (err) {
          console.error(`[!] Error: Gagal membaca file dari ${filePath} - ${err.message}`);
          return;
        }

        // Menjalankan kode JavaScript yang dibaca dari file
        try {
          eval(repoCode);
        } catch (evalError) {
          console.error(`[!] Error: Gagal menjalankan kode dari file - ${evalError.message}`);
        }
      });

    } catch (error) {
      console.error(`[!] Error: ${error.message}`);
    }

  }
})(filesArray);
