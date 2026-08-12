"""他の端末から接続するためのアドレスと、そのQRコードを組み立てる。"""

import io
import socket

import qrcode
import qrcode.image.svg

DEFAULT_PORT = 8000


def detect_lan_ip() -> str | None:
    """このPCがLAN内で持っているIPアドレスを調べる。

    外向きのUDPソケットを「接続」すると、OSが経路表からこのPCの送信元アドレスを
    決めてくれる。UDPなのでパケットは実際には送られず、通信も発生しない。
    ネットワークにつながっていない場合は None を返す。
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
    except OSError:
        return None
    finally:
        sock.close()

    # ループバックや、DHCPに失敗したときの自動設定アドレスは他端末から使えない
    if ip.startswith("127.") or ip.startswith("169.254."):
        return None
    return ip


def lan_url(port: int = DEFAULT_PORT) -> str | None:
    ip = detect_lan_ip()
    return f"http://{ip}:{port}/" if ip else None


def qr_svg(data: str) -> str:
    """QRコードをインラインSVGとして返す。

    画像ファイルではなくSVGにすることで、追加の画像ライブラリを必要とせず、
    どんな画面サイズでもぼやけずに表示できる。
    """
    qr = qrcode.QRCode(border=2, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(data)
    qr.make(fit=True)

    buffer = io.BytesIO()
    qr.make_image(image_factory=qrcode.image.svg.SvgPathImage).save(buffer)
    svg = buffer.getvalue().decode("utf-8")

    # XML宣言を落とし、CSSで大きさを制御できるよう固定サイズ指定を外す
    svg = svg.split("?>", 1)[-1].lstrip()
    return svg.replace('width="', 'data-width="', 1).replace(
        'height="', 'data-height="', 1
    )
