from flask import Flask, request, jsonify, send_from_directory, abort
import os
import uuid
import time
import re
import threading
import json
import shutil
from datetime import datetime
from module.ocr import Ocr
from module.splitter import Splitter

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 45 * 1024 * 1024
UPLOAD_FOLDER = 'uploads'
PROCESSED_FOLDER = 'files'
TEMP_FOLDER = 'temp'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

def load_api_keys():
    try:
        with open('apikey.json', 'r') as f:
            return json.load(f)
    except Exception as e:
        # print(f"Error loading API keys: {e}")
        return None

def check_apikey_access(apikey, path):
    apikeys = load_api_keys()
    if not apikeys:
        return False, "Kesalahan internal, API tidak dapat beroperasi."

    apikey_info = apikeys.get(apikey)
    if not apikey_info:
        return False, "Permintaan ditolak (apikey tidak valid)"

    expired = apikey_info.get('expired')
    if expired == 'administrator':
        if path != '/uail/settings':
            return False, "Permintaan ditolak (akses terbatas untuk administrator)"
    elif expired == 'limitless':
        if re.match(r'^/uail/(process|files/[0-9A-Za-z.-]+)$', path):
            return True, None
        else:
            return False, "Permintaan ditolak (apikey tidak valid)"
    else:
        try:
            expiration_date = datetime.strptime(expired, '%Y-%m-%d %H:%M:%S')
            if datetime.now() > expiration_date:
                if re.match(r'^/uail/(files/[0-9A-Za-z.-]+)$', path):
                    return False, "Permintaan ditolak (apikey telah kedaluwarsa)"
                return False, "Permintaan ditolak (apikey telah kedaluwarsa)"
            if not re.match(r'^/uail/(process|files/[0-9A-Za-z.-]+)$', path):
                return False, "Permintaan ditolak (akses terbatas)"
        except ValueError:
            return False, "Kesalahan internal, API tidak dapat beroperasi."

    return True, None

def delete_old_files_and_folders():
    while True:
        current_time = time.time()
        folders = [UPLOAD_FOLDER, PROCESSED_FOLDER, TEMP_FOLDER]

        for folder in folders:
            for item in os.listdir(folder):
                item_path = os.path.join(folder, item)
                if os.path.isfile(item_path):
                    file_age = current_time - os.path.getmtime(item_path)
                    if file_age > 5 * 60:
                        os.remove(item_path)
                elif os.path.isdir(item_path):
                    dir_age = current_time - os.path.getmtime(item_path)
                    if dir_age > 5 * 60:
                        shutil.rmtree(item_path)

        time.sleep(20)

def get_apikey_from_post():
    return request.form.get("apikey")

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({"error": "Berkas terlalu besar. Maksimal ukuran berkas adalah 45 MB."}), 413

@app.before_request
def validate_apikey():
    apikey = get_apikey_from_post()
    if not apikey:
        return jsonify({"error": "Permintaan ditolak (apikey tidak dikirimkan)"}), 401

    path = request.path
    is_valid, error_message = check_apikey_access(apikey, path)
    if not is_valid:
        return jsonify({"error": error_message}), 401

@app.route('/uail/process', methods=['POST'])
def process_file():
    apikey = get_apikey_from_post()
    if not apikey:
        return jsonify({"error": "Permintaan ditolak (apikey tidak dikirimkan)"}), 401

    if 'file' not in request.files:
        return jsonify({"error": "Permintaan ditolak (berkas tidak dikirimkan)"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Permintaan ditolak (berkas tidak dikirimkan)"}), 400

    if not request.form.get("split") and not request.form.get("rename"):
        return jsonify({"error": "Permintaan ditolak (tidak ada opsi yang dipilih)"}), 400

    filename = request.files['file'].filename
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    
    try:

        file.save(file_path)

        if request.form.get("rename"):

            processor = Ocr(file_path)
            start_page = 2
            end_page = 4
            text = processor.extract_text_from_pdf(start_page, end_page)
            result = processor.find_ids_and_agenda_numbers(text)

            if result:
                id_pelanggan, no_agenda = result
                output_prefix = f"{id_pelanggan}-{no_agenda}"

                return jsonify({"filename": output_prefix})

            return jsonify({"error": "ID Pelanggan atau No Agenda tidak ditemukan"}), 400

        if request.form.get("split"):

            splitter = Splitter(file_path, filename[:-4])
            result_files, result_count = splitter.split_and_compress_pdf()

            if result_files == False:
                return jsonify({"error": "Ukuran file atau jumlah halaman masih terlalu besar."}), 400

            file_urls = []
            for file in result_files:
                file_urls.append(f'/uail/files/{os.path.basename(file)}')

            return jsonify({"files": file_urls})

    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

@app.route('/uail/files/<path:filename>', methods=['POST'])
def download_file(filename):
    apikey = get_apikey_from_post()
    if not apikey:
        return jsonify({"error": "Permintaan ditolak (apikey tidak dikirimkan)"}), 401

    is_valid, error_message = check_apikey_access(apikey, request.path)
    if not is_valid:
        return jsonify({"error": error_message}), 401

    file_path = os.path.join(PROCESSED_FOLDER, filename)
    if not os.path.isfile(file_path):
        return jsonify({"error": "File tidak ditemukan"}), 404

    return send_from_directory(PROCESSED_FOLDER, filename)

@app.route('/uail/settings', methods=['POST'])
def settings():
    apikey = get_apikey_from_post()
    if not apikey:
        return jsonify({"error": "Permintaan ditolak (apikey tidak dikirimkan)"}), 401

    is_valid, error_message = check_apikey_access(apikey, request.path)
    if not is_valid:
        return jsonify({"error": error_message}), 401

    return jsonify({"message": "Settings page."})

if __name__ == "__main__":
    deletion_thread = threading.Thread(target=delete_old_files_and_folders, daemon=True)
    deletion_thread.start()

    app.run(debug=True)