from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import logging
import datetime

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)

def get_liturgical_readings(date_str):
    """
    Scrapes readings from evangeliodeldia.org for the given date.
    Date format: YYYY-MM-DD
    """
    try:
        # Construct URL. evangeliodeldia.org uses format like: 2023-10-27
        url = f"https://evangeliodeldia.org/SP/gospel/{date_str}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        logging.info(f"Fetching URL: {url}")
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        readings = []
        
        # Strategy: Look for the main content container
        content_div = soup.find('div', class_='content_body') or soup.find('div', id='content')
        if not content_div:
            content_div = soup.body

        # Keywords to identify sections
        keywords = {
            "Primera Lectura": "first_reading",
            "Salmo Responsorial": "psalm",
            "Segunda Lectura": "second_reading",
            "Evangelio": "gospel"
        }

        # Naive but robust scraping: 
        text_content = content_div.get_text("\n", strip=True)
        lines = text_content.split('\n')
        
        buffer = []
        current_section = None
        current_ref = ""
        readings_found = {} # Keyed by type

        for i, line in enumerate(lines):
            line = line.strip()
            if not line: continue
            
            # Check if this line is a known header
            detected_type = None
            for key, val in keywords.items():
                if key.lower() in line.lower():
                    detected_type = val
                    break
            
            if detected_type:
                # Save previous section if exists
                if current_section and buffer:
                    full_text = " ".join(buffer).strip()
                    if current_section not in readings_found:
                         readings_found[current_section] = {
                            "type": current_section,
                            "title": line, # Use header as title initially
                            "reference": current_ref,
                            "text": full_text
                        }
                
                # Start new section
                current_section = detected_type
                buffer = []
                current_ref = ""
                
                # Heuristic: The Next line often contains the reference (e.g., "Is 25, 6-10")
                if i + 1 < len(lines):
                    next_line = lines[i+1].strip()
                    # If it has numbers, assume it's a reference
                    if any(c.isdigit() for c in next_line):
                        current_ref = next_line
                
            else:
                if current_section:
                    # Avoid adding the reference line to the body text
                    if line != current_ref:
                        buffer.append(line)
        
        # Save the very last section
        if current_section and buffer:
             full_text = " ".join(buffer).strip()
             if current_section not in readings_found:
                 readings_found[current_section] = {
                    "type": current_section,
                    "title": current_section.replace("_", " ").title(),
                    "reference": current_ref,
                    "text": full_text
                }

        # Format output as a list in liturgical order
        ordered_keys = ["first_reading", "psalm", "second_reading", "gospel"]
        for k in ordered_keys:
            if k in readings_found:
                readings.append(readings_found[k])
                
        return readings

    except Exception as e:
        logging.error(f"Error scraping: {e}")
        return []

@app.route('/api/readings', methods=['GET'])
def get_readings():
    date = request.args.get('date')
    if not date:
        return jsonify({"error": "Date parameter is required"}), 400
    
    logging.info(f"Requesting readings for {date}")
    
    try:
        data = get_liturgical_readings(date)
        
        if not data:
            logging.warning("No data found via scraping.")
            return jsonify([]), 200 

        return jsonify(data)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
