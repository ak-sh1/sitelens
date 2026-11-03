"""Create a reproducible, source-included release without dependencies or raw data."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
destination = root.parent / 'SiteLens.zip'
excluded = {'node_modules', '.artifacts', '.venv', '__pycache__', '.git', '.pytest_cache'}
files = []
for path in sorted(root.rglob('*')):
    if not path.is_file():
        continue
    relative = path.relative_to(root)
    if any(part in excluded for part in relative.parts) or relative.parts[:2] == ('ml', 'data'):
        continue
    if path.suffix in {'.zip', '.log'}:
        continue
    files.append((path, relative))
with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path, relative in files:
        info = zipfile.ZipInfo('sitelens/' + relative.as_posix(), (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100755 if relative.name == 'start-demo.command' else 0o100644) << 16
        archive.writestr(info, path.read_bytes())
print(f'{destination}: {len(files)} files, {destination.stat().st_size:,} bytes')
