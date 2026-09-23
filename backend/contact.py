import smtplib
import ssl
from email.message import EmailMessage
from flask import jsonify, request, current_app
from email_validator import validate_email, EmailNotValidError
from auth import auth, limiter
import config


@auth.post('/contact')
@limiter.limit('5 per hour')
def contact():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(success=False, message='Data tidak valid.'), 400
    if data.get('website'):
        return jsonify(success=False, message='Pesan ditolak.'), 400
    limits = {'name': (2,100), 'email': (3,150), 'subject': (3,150), 'message': (10,3000)}
    values = {}
    for key, (low, high) in limits.items():
        value = data.get(key)
        if not isinstance(value, str) or not low <= len(value.strip()) <= high:
            return jsonify(success=False, message='Periksa panjang seluruh isian.'), 400
        values[key] = value.strip()
    if any('\n' in values[k] or '\r' in values[k] for k in ('name','email','subject')):
        return jsonify(success=False, message='Isian tidak valid.'), 400
    try:
        validate_email(values['email'], check_deliverability=False)
    except EmailNotValidError:
        return jsonify(success=False, message='Email tidak valid.'), 400
    if not config.EMAIL_ADDRESS or not config.EMAIL_PASSWORD:
        return jsonify(success=False, message='Layanan pesan belum aktif. Hubungi official@jaydream.store.'), 503
    message = EmailMessage()
    message['From'] = config.EMAIL_ADDRESS
    message['To'] = 'official@jaydream.store'
    message['Reply-To'] = values['email']
    message['Subject'] = '[JayDreamStore] ' + values['subject']
    message.set_content('Nama: '+values['name']+'\nEmail: '+values['email']+'\n\n'+values['message'])
    try:
        with smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT,
                              timeout=12, context=ssl.create_default_context()) as smtp:
            smtp.login(config.EMAIL_ADDRESS, config.EMAIL_PASSWORD)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException):
        current_app.logger.warning('Contact SMTP gagal, detail pelanggan tidak dicatat.')
        return jsonify(success=False, message='Pesan belum terkirim. Silakan coba lagi nanti.'), 503
    return jsonify(success=True, message='Pesan berhasil diserahkan ke server email. Terima kasih!')
