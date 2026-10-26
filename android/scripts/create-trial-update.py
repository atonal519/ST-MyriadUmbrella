#!/usr/bin/env python3
"""Generate the local trial update feed from a verified APK; never upload anything.
Publish the APK asset first, then place this feed at the repository root on main.
The app reads the fixed raw.githubusercontent.com URL; this helper never uploads.
Part of this AGPL-3.0 project. Add Android SDK Build Tools to PATH before running.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
from urllib.parse import quote

REPOSITORY = 'atonal519/ST-MyriadUmbrella'
PACKAGE = 'io.github.bainiao.browser.trial'
CERTIFICATE = 'e24abe2b69b95fb7f4208a7aa6db1fda73dab08daa652416ab67ca22779f43bb'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('apk', type=Path)
    parser.add_argument('--notes', required=True)
    parser.add_argument('--tag')
    parser.add_argument('--output', type=Path, default=Path('qianjisan-trial-update.json'))
    args = parser.parse_args()
    for tool in ('aapt2', 'apksigner'):
        if not shutil.which(tool):
            parser.error('请先将 Android SDK Build Tools 中的 aapt2 和 apksigner 加入 PATH。')
    if not args.apk.is_file():
        parser.error('找不到 APK。')
    badging = subprocess.run(['aapt2', 'dump', 'badging', str(args.apk)], capture_output=True, text=True, check=True).stdout
    package = re.search(r"package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", badging)
    if not package or package[1] != PACKAGE:
        parser.error('APK 不是千机伞试用包。')
    code, version = int(package[2]), package[3]
    if code <= 0 or not re.fullmatch(r'[A-Za-z0-9._-]+', version):
        parser.error('APK 版本信息无效。')
    name = f'qianjisan-{version}.apk'
    if args.apk.name != name:
        parser.error(f'请先将发布文件命名为 {name}。')
    tag = args.tag or f'apk-v{version}'
    if not tag.startswith('apk-v') or not re.fullmatch(r'[A-Za-z0-9._-]+', tag):
        parser.error('APK 标签必须以 apk-v 开头，并使用字母、数字、点或短横线。')
    signed = subprocess.run(['apksigner', 'verify', '--print-certs', str(args.apk)], capture_output=True, text=True, check=True).stdout
    certificates = re.findall(r'certificate SHA-256 digest: ([0-9a-fA-F]+)', signed)
    if certificates != [CERTIFICATE]:
        parser.error('APK 证书与当前试用线不一致。')
    size = args.apk.stat().st_size
    if not 0 < size <= 128 * 1024 * 1024:
        parser.error('APK 大小超出更新范围。')
    digest = hashlib.sha256()
    with args.apk.open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            digest.update(block)
    now = datetime.now(timezone.utc)
    feed = {'app': PACKAGE, 'updatedAt': now.isoformat().replace('+00:00', 'Z'), 'releases': [{
        'versionName': version, 'versionCode': code,
        'url': f'https://github.com/{REPOSITORY}/releases/download/{quote(tag, safe="")}/{quote(name, safe="")}',
        'size': size, 'sha256': digest.hexdigest(), 'date': now.date().isoformat(),
        'channel': 'trial', 'notes': args.notes,
    }]}
    args.output.write_text(json.dumps(feed, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'仅本地生成：{args.output}\n标签：{tag}\n附件：{name} 与 qianjisan-trial-update.json')

if __name__ == '__main__':
    main()
