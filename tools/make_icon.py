"""アプリのアイコン一式を生成する。

- static/stack.ico          デスクトップショートカット用
- static/icon-192.png       PWAマニフェスト用(ホーム画面・タスクバー)
- static/icon-512.png       PWAマニフェスト用(高解像度)

追加ライブラリを増やさないよう、PNGとICOを標準ライブラリだけで書き出している。
デザインを変えないかぎり再実行の必要はなく、生成物はリポジトリに含めている。
"""

import struct
import zlib
from pathlib import Path

BG = (0x17, 0x15, 0x1C)
# (上端, 下端, 左端, 右端) を 0.0〜1.0 の比率で指定し、どのサイズで描いても同じ形になるようにする
BAR_RATIOS = [
    (0.586, 0.766, 0.172, 0.828, (0xA9, 0x78, 0x2F)),
    (0.391, 0.555, 0.234, 0.766, (0xC2, 0x93, 0x45)),
    (0.195, 0.359, 0.297, 0.703, (0xD9, 0xB4, 0x6A)),
]
CORNER_RATIO = 0.203  # 256px時の52pxに相当


def _inside_rounded_square(x: int, y: int, size: int, radius: int) -> bool:
    """角を丸めた正方形の内側かどうか。"""
    cx = min(max(x, radius), size - 1 - radius)
    cy = min(max(y, radius), size - 1 - radius)
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= radius * radius


def _build_rows(size: int) -> list[bytes]:
    radius = round(size * CORNER_RATIO)
    bars = [
        (
            round(top * size),
            round(bottom * size),
            round(left * size),
            round(right * size),
            color,
        )
        for top, bottom, left, right, color in BAR_RATIOS
    ]

    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            if not _inside_rounded_square(x, y, size, radius):
                row += b"\x00\x00\x00\x00"  # 透明
                continue
            color = BG
            for top, bottom, left, right, bar_color in bars:
                if top <= y < bottom and left <= x < right:
                    color = bar_color
                    break
            row += bytes(color) + b"\xff"
        rows.append(bytes(row))
    return rows


def _png(size: int) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return (
            struct.pack(">I", len(data))
            + body
            + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
        )

    rows = _build_rows(size)
    raw = b"".join(b"\x00" + row for row in rows)  # 各行の先頭はフィルタ種別
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def _ico(png_bytes: bytes, size: int) -> bytes:
    # Vista以降のICOはPNGをそのまま格納できる。256px以上は幅・高さを0で表す。
    header = struct.pack("<HHH", 0, 1, 1)
    dim = 0 if size >= 256 else size
    entry = struct.pack(
        "<BBBBHHII", dim, dim, 0, 0, 1, 32, len(png_bytes), struct.calcsize("<HHH") + 16
    )
    return header + entry + png_bytes


def main() -> None:
    static_dir = Path(__file__).resolve().parent.parent / "static"

    ico_path = static_dir / "stack.ico"
    ico_path.write_bytes(_ico(_png(256), 256))
    print(f"生成しました: {ico_path} ({ico_path.stat().st_size} bytes)")

    for size in (192, 512):
        png_path = static_dir / f"icon-{size}.png"
        png_path.write_bytes(_png(size))
        print(f"生成しました: {png_path} ({png_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
