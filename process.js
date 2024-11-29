// processFiles.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

async function processFiles(filesArray, config) {
  let fixedUpload = {};

  for (const filePath of filesArray) {
    const fileName = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;
    let uploadedFiles = [filePath];
    const filePattern = /^[0-9]{12}-[0-9]{18}\.pdf$/;

    if (config.upload && !filePattern.test(fileName)) {
      console.log(
        "[i] Berkas",
        fileName,
        "dilewati karena nama berkas tidak sesuai"
      );
      continue;
    }

    if (config.rename && filePattern.test(fileName)) {
      const renameFolder = config.path.rename;
      const destPath = path.join(renameFolder, fileName);
      fs.renameSync(filePath, destPath);
    } else if (config.rename || (config.upload && fileSize > 2 * 1024 * 1024)) {
      try {
        const firstFormData = new FormData();
        firstFormData.append("apikey", config.apikey);
        firstFormData.append(config.rename ? "rename" : "split", "1");
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
          if (config.rename) {
            const newFileName = response.data.filename + ".pdf";
            const destPath = path.join(config.path.rename, newFileName);
            fs.renameSync(filePath, destPath);
          }

          if (config.upload) {
            uploadedFiles = [];
            for (const resultFile of response.data.files) {
              const fileUrl = `${config.api}${resultFile}`;
              const destPath = path.join(config.path.temp, path.basename(fileUrl));
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

                downloadResponse.data.pipe(writer);

                await new Promise((resolve, reject) => {
                  writer.on("finish", () => {
                    uploadedFiles.push(destPath);
                    resolve();
                  });
                  writer.on("error", reject);
                });
              } catch (error) {
                console.warn(
                  `[!] Gagal mengunduh berkas ${path
                    .basename(filePath)
                    .slice(0, 31)} (akan dilewati)`
                );
                uploadedFiles.forEach((filePath) => {
                  try {
                    fs.unlinkSync(filePath);
                  } catch (unlinkError) {}
                });
                uploadedFiles = [];
                break;
              }
            }
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
        if (
          error.response &&
          error.response.data &&
          error.response.data.error
        ) {
          if (error.response.data.error.includes("ID Pelanggan")) {
            console.warn(`[!] ${error.response.data.error}:`, filePath);
            continue;
          }
          console.warn("[!] Error:", error.response.data.error);
        } else {
          console.log(error);
          console.warn("[!] Error:", error.message);
        }
        process.exit(1);
      }
      fixedUpload[filePath] = uploadedFiles;
    }
  }
  return fixedUpload;
}

module.exports = { processFiles };
