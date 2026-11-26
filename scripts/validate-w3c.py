"""Send public HTML/CSS to W3C only with the project owner's permission.
Run: python scripts/validate-w3c.py [html|css|all]
Raw responses and source hashes are saved for the course report.
"""
from pathlib import Path
import datetime
import hashlib
import json
import sys
import time
import xml.etree.ElementTree as ET
import urllib.request

root = Path(__file__).resolve().parent.parent
output = root / 'quality' / 'w3c'
output.mkdir(parents=True, exist_ok=True)
mode = sys.argv[1] if len(sys.argv) > 1 else 'all'
files = []
if mode in ('all', 'html'):
    files += sorted(root.glob('*.html')) + sorted((root / 'rooms').glob('*.html')) + sorted((root / 'facilities').glob('*.html'))
if mode in ('all', 'css'):
    files += sorted((root / 'assets/css').glob('*.css'))

if len(sys.argv) > 2:
    files = [file for file in files if file.relative_to(root).as_posix() in sys.argv[2:]]

def validate(file):
    source = file.read_bytes()
    record = {'file': file.relative_to(root).as_posix(), 'sha256': hashlib.sha256(source).hexdigest(),
              'checked_utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    name = record['file'].replace('/', '__')
    try:
        if file.suffix == '.html':
            url = 'https://validator.w3.org/nu/?out=json'
            data = source
            content_type = 'text/html; charset=utf-8'
        else:
            url = 'https://jigsaw.w3.org/css-validator/validator'
            fields = {'text': source.decode('utf-8'), 'output': 'soap12', 'profile': 'css3svg', 'warning': '1', 'vextwarning': 'true', 'lang': 'en'}
            boundary = 'BankHotelValidationBoundary'
            data = (''.join('--' + boundary + '\r\nContent-Disposition: form-data; name="' + key + '"\r\n\r\n' + value + '\r\n' for key, value in fields.items()) + '--' + boundary + '--\r\n').encode('utf-8')
            content_type = 'multipart/form-data; boundary=' + boundary
        record['validator'] = url
        if file.suffix == '.css': record['profile'] = 'css3svg'
        request = urllib.request.Request(url, data=data, headers={'Content-Type':content_type, 'User-Agent':'BankHotel-course-check/1.0'})
        with urllib.request.urlopen(request, timeout=45) as response:
            body = response.read().decode('utf-8')
        if file.suffix == '.html':
            result = json.loads(body)
            (output / (name + '.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
            record['errors'] = sum(m['type'] == 'error' for m in result.get('messages', []))
            record['warnings'] = sum(m.get('subType') == 'warning' for m in result.get('messages', []))
        else:
            (output / (name + '.xml')).write_text(body, encoding='utf-8')
            validation = ET.fromstring(body)
            record['errors'] = int(validation.findtext('.//{*}errorcount'))
            record['warnings'] = int(validation.findtext('.//{*}warningcount'))
        record['status'] = 'checked'
    except Exception as error:
        record['status'] = 'unavailable'
        record['reason'] = str(error)
    print(json.dumps(record, ensure_ascii=False), flush=True)
    return record

records = []
for file in files:
    records.append(validate(file))
    time.sleep(1.1)
previous_file = output / 'all-summary.json'
previous = json.loads(previous_file.read_text(encoding='utf-8')) if previous_file.exists() else []
merged = {record['file']: record for record in previous}
merged.update({record['file']: record for record in records})
for kind in ('all', 'html', 'css'):
    selected = [record for record in merged.values() if kind == 'all' or record['file'].endswith('.' + kind)]
    (output / (kind + '-summary.json')).write_text(json.dumps(selected, ensure_ascii=False, indent=2), encoding='utf-8')
if any(record['status'] != 'checked' or record.get('errors', 0) for record in records):
    sys.exit(1)
