from PyPDF2 import PdfReader, PdfWriter
from io import BytesIO
import subprocess
import os
import shutil
import uuid
import re

class Splitter:
    def __init__(self, input_pdf_path, output_prefix, max_size=2 * 1024 * 1024):
        self.input_pdf_path = input_pdf_path
        self.output_prefix = output_prefix
        self.max_size = max_size
        self.session_id = str(uuid.uuid4())
        self.temp_dir = os.path.join(os.path.dirname(__file__), '..', 'temp', f'temp_pages_{self.session_id}')
        self.output_dir = os.path.join(os.path.dirname(__file__), '..', 'files')
        os.makedirs(self.temp_dir, exist_ok=True)
        os.makedirs(self.output_dir, exist_ok=True)

    def get_pdf_page_size_in_bytes(self, page):
        buffer = BytesIO()
        temp_writer = PdfWriter()
        temp_writer.add_page(page)
        temp_writer.write(buffer)
        size = buffer.tell()
        buffer.close()
        return size

    def save_pdf(self, writer, index):

        save_name_match = re.search(r'\d{12}-\d{18}', self.input_pdf_path)

        if save_name_match:
            save_name = save_name_match.group()
        else:
            save_name = None

        file_name = f'{save_name if save_name else self.session_id}.{index}.pdf'
        file_path = os.path.join(self.output_dir, file_name)

        with open(file_path, 'wb') as f:
            writer.write(f)
        return file_path

    def compress_pdf_file(self, input_path, output_path):
        subprocess.call(
            [
                "gs",
                "-sDEVICE=pdfwrite",
                "-dCompatibilityLevel=1.4",
                "-dPDFSETTINGS=/prepress",
                "-dNOPAUSE",
                "-dQUIET",
                "-dBATCH",
                "-sOutputFile=" + output_path,
                input_path,
            ]
        )
        return output_path

    def split_and_compress_pdf(self):
        reader = PdfReader(open(self.input_pdf_path, 'rb'))

        compressed_files = []
        for i in range(len(reader.pages)):
            page = reader.pages[i]
            temp_writer = PdfWriter()
            temp_writer.add_page(page)
            temp_page_path = os.path.join(self.temp_dir, f'page_{i}.pdf')
            with open(temp_page_path, 'wb') as f:
                temp_writer.write(f)

            compressed_page_path = os.path.join(self.temp_dir, f'compressed_page_{i}.pdf')
            self.compress_pdf_file(temp_page_path, compressed_page_path)
            compressed_files.append(compressed_page_path)

        output_files = []
        current_writer = PdfWriter()
        current_size = 0
        index = 0

        for compressed_file in compressed_files:
            with open(compressed_file, 'rb') as f:
                compressed_reader = PdfReader(f)
                page = compressed_reader.pages[0]
                page_size = self.get_pdf_page_size_in_bytes(page)

                if page_size > self.max_size:
                    return False, False

                if current_size + page_size > self.max_size:
                    output_files.append(self.save_pdf(current_writer, index))
                    current_writer = PdfWriter()
                    current_size = 0
                    index += 1

                current_writer.add_page(page)
                current_size += page_size

        if len(current_writer.pages) > 0:
            output_files.append(self.save_pdf(current_writer, index))

        shutil.rmtree(self.temp_dir)

        if len(output_files) > 13:
            return False, False

        return output_files, len(output_files)
