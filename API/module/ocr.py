from pdf2image import convert_from_path
from rapidocr_onnxruntime import RapidOCR
from PIL import Image
import re

class Ocr:
    def __init__(self, pdf_path):
        self.pdf_path = pdf_path
        self.ocr = RapidOCR()

    def extract_text_from_pdf(self, start_page, end_page):
        images = convert_from_path(self.pdf_path, poppler_path=r'Release-24.08.0-0\poppler-24.08.0\Library\bin')
        if start_page < 1 or end_page > len(images) or start_page > end_page:
            raise ValueError(f"Invalid page range: {start_page}-{end_page}. The PDF has {len(images)} pages.")
        combined_image = self.combine_images(images[start_page-1:end_page-1])
        results = self.ocr(combined_image)
        extracted_text = ""
        if results and isinstance(results[0], list):
            text = [item[1] for item in results[0] if len(item) > 1]
            extracted_text = "\n".join(text) + "\n"
        return extracted_text

    def combine_images(self, images):
        total_height = sum(image.height for image in images)
        max_width = max(image.width for image in images)
        combined_image = Image.new('RGB', (max_width, total_height))
        current_y = 0
        for image in images:
            combined_image.paste(image, (0, current_y))
            current_y += image.height
        return combined_image

    def find_ids_and_agenda_numbers(self, text):
        cleaned_text = re.sub(r'[^\d\s]', '', text)
        id_pelanggan = re.findall(r'\b\d{12}\b', cleaned_text)
        no_agenda = re.findall(r'\b\d{18}\b', cleaned_text)
        id_pelanggan = list(set(id_pelanggan))
        no_agenda = list(set(no_agenda))
        valid_id_pelanggan = None
        valid_no_agenda = None
        for id in id_pelanggan:
            id_prefix = id[:5]
            matching_no_agenda = [agenda for agenda in no_agenda if agenda.startswith(id_prefix)]
            if matching_no_agenda:
                valid_id_pelanggan = id
                valid_no_agenda = matching_no_agenda[0]
                break
        if valid_id_pelanggan and valid_no_agenda:
            return valid_id_pelanggan, valid_no_agenda
        return False
