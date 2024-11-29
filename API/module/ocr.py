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
        
        combined_text = ""
        for current_page in range(start_page - 1, end_page):
            current_image = images[current_page]
            results = self.ocr(current_image)

            if results and isinstance(results[0], list):
                text = [item[1] for item in results[0] if len(item) > 1]
                combined_text += "\n".join(text) + "\n"

            validation_result = self.find_ids_and_agenda_numbers(combined_text)
            if validation_result:
                return combined_text
        
        return combined_text

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
