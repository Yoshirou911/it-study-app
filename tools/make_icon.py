"""デスクトップのショートカット用アイコン(static/stack.ico)を生成する。

追加ライブラリを増やさないよう、PNGとICOを標準ライブラリだけで書き出している。
1度実行すればよく、生成物はリポジトリに含めている。
"""

import struct
import zlib
from pathlib import Path

SIZE = 256
BG = (0x17, 0x15, 0x1C)
BARS = [
    # (上端, 下端, 左端, 右端, 色) — 下ほど広い、積み上がった3段
    (150, 196, 44, 212, (0xA9, 0x78, 0x2F)),
    (100, 142, 60, 196, (0xC2, 0x93, 0x45)),
    (50, 92, 76, 180, (0xD9, 0xB4, 0x6A)),
]
CORNER_RADIUS = 52


def _inside_rounded_square(x: int, y: int) -> bool:
    """角を丸めた正方形の内側かどうか。"""
    r = CORNER_RADIUS
    cx = min(max(x, r), SIZE - 1 - r)
    cy = min(max(y, r), SIZE - 1 - r)
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= r * r


def _build_rows() -> list[bytes]:
    rows = []
    for y in range(SIZE):
        row = bytearray()
        for x in range(SIZE):
            if not _inside_rounded_square(x, y):
                row += b"\x00\x00\x00\x00"  # 透明
                continue
            color = BG
            for top, bottom, left, right, bar_color in BARS:
                if top <= y < bottom and left <= x < right:
                    color = bar_color
                    break
            row += bytes(color) + b"\xff"
        rows.append(bytes(row))
    return rows


def _png(rows: list[bytes]) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return (
            struct.pack(">I", len(data))
            + body
            + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
        )

    raw = b"".join(b"\x00" + row for row in rows)  # 各行の先頭はフィルタ種別
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def _ico(png_bytes: bytes) -> bytes:
    # Vista以降のICOはPNGをそのまま格納できる。256pxは幅・高さを0で表す。
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack(
        "<BBBBHHII", 0, 0, 0, 0, 1, 32, len(png_bytes), struct.calcsize("<HHH") + 16
    )
    return header + entry + png_bytes


def main() -> None:
    out = Path(__file__).resolve().parent.parent / "static" / "stack.ico"
    out.write_bytes(_ico(_png(_build_rows())))
    print(f"生成しました: {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
