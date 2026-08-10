import smtplib
from email.message import EmailMessage
import config


def send_product_email(
    customer_email,
    product_name,
    download_link
):

    message = EmailMessage()

    message["Subject"] = f"Pembelian berhasil | {product_name}"

    message["From"] = config.EMAIL_ADDRESS

    message["To"] = customer_email

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <body style="
        font-family: Arial, sans-serif;
        background: #f5f5f5;
        padding: 30px;
    ">

        <div style="
            max-width: 600px;
            margin: auto;
            background: white;
            padding: 30px;
            border-radius: 12px;
        ">

            <h1>JayDreamStore</h1>

            <h2>Pembayaran Berhasil 🎉</h2>

            <p>
                Terima kasih sudah membeli
                <strong>{product_name}</strong>.
            </p>

            <p>
                Produk milikmu sudah siap diunduh.
            </p>

            <a href="{download_link}"
               style="
                    display: inline-block;
                    padding: 14px 24px;
                    background: #f59e0b;
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: bold;
               ">
                Download Produk
            </a>

            <p style="margin-top: 30px;">
                Jika tombol tidak bekerja, gunakan link berikut:
            </p>

            <p>
                {download_link}
            </p>

            <hr>

            <p>
                JayDreamStore
            </p>

        </div>

    </body>
    </html>
    """

    message.set_content(
        f"""
Pembayaran berhasil.

Produk: {product_name}

Download:
{download_link}

JayDreamStore
"""
    )

    message.add_alternative(
        html_content,
        subtype="html"
    )

    with smtplib.SMTP_SSL(
        "smtp.gmail.com",
        465
    ) as smtp:

        smtp.login(
            config.EMAIL_ADDRESS,
            config.EMAIL_PASSWORD
        )

        smtp.send_message(message)