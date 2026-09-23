"""Authentication extension. Uses existing database.db and models.User."""
import os
from datetime import timedelta
from functools import wraps

from flask import Blueprint, current_app, g, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, get_csrf_token, get_jwt,
    get_jwt_identity, jwt_required, set_access_cookies, unset_jwt_cookies,
)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash
from email_validator import validate_email, EmailNotValidError
from database import db
from models import User

auth = Blueprint('auth', __name__)
limiter = Limiter(key_func=get_remote_address, default_limits=[])
jwt = JWTManager()


class AccountProfile(db.Model):
    __tablename__ = 'auth_account_profile'
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    role = db.Column(db.String(20), nullable=False, default='user')
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.now())


class RevokedToken(db.Model):
    __tablename__ = 'auth_revoked_token'
    jti = db.Column(db.String(64), primary_key=True)
    expires_at = db.Column(db.BigInteger, nullable=False)


def fail(message, status):
    return jsonify(success=False, message=message), status


def public_user(user):
    profile = db.session.get(AccountProfile, user.id)
    return dict(id=user.id, username=user.username, email=user.email,
                role=profile.role if profile else 'user')


def init_auth(app):
    production = os.getenv('APP_ENV', 'production') != 'development'
    secret = os.getenv('AUTH_SECRET_KEY', '')
    if len(secret) < 32:
        raise RuntimeError('AUTH_SECRET_KEY wajib diisi minimal 32 karakter acak.')
    origins = [v.strip().rstrip('/') for v in os.getenv(
        'AUTH_ALLOWED_ORIGINS', 'https://jaydream.store,https://www.jaydream.store'
    ).split(',') if v.strip()]
    if not origins or '*' in origins or (production and any(
        not v.startswith('https://') for v in origins
    )):
        raise RuntimeError('AUTH_ALLOWED_ORIGINS harus berisi origin HTTPS yang spesifik.')
    storage = os.getenv('AUTH_RATE_STORAGE', 'memory://')
    if production and storage == 'memory://':
        raise RuntimeError('Production membutuhkan AUTH_RATE_STORAGE Redis bersama.')
    app.config.update(
        JWT_SECRET_KEY=secret, JWT_TOKEN_LOCATION=['cookies'],
        JWT_COOKIE_SECURE=production, JWT_COOKIE_SAMESITE='Lax',
        JWT_ACCESS_COOKIE_NAME='jd_access', JWT_COOKIE_DOMAIN=None,
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(hours=8),
        JWT_COOKIE_CSRF_PROTECT=True, JWT_CSRF_IN_COOKIES=False,
        AUTH_ALLOWED_ORIGINS=origins,
    )
    jwt.init_app(app)
    app.config['RATELIMIT_STORAGE_URI'] = storage
    limiter.init_app(app)
    # Remove the old CORS(app) before installing this extension.
    CORS(app, resources={r'/(register|login|logout|me|contact)': {
        'origins': origins, 'supports_credentials': True,
        'allow_headers': ['Content-Type', 'X-CSRF-TOKEN'],
        'methods': ['GET', 'POST', 'OPTIONS'],
    }})
    app.register_blueprint(auth)
    app.extensions['auth_dummy_hash'] = generate_password_hash('dummy-not-an-account')

    @app.errorhandler(429)
    def too_many(_error):
        return fail('Terlalu banyak percobaan. Coba lagi nanti.', 429)

    @app.cli.command('auth-init-db')
    def init_tables():
        # Adds missing tables. Does not rename columns or delete existing data.
        db.create_all()
        print('Tabel akun dan pencabutan token siap.')


@jwt.token_in_blocklist_loader
def revoked(_header, payload):
    return db.session.get(RevokedToken, payload['jti']) is not None


@jwt.unauthorized_loader
def missing(_reason):
    return fail('Sesi tidak tersedia atau token CSRF tidak cocok.', 401)


@jwt.invalid_token_loader
def invalid(_reason):
    return fail('Sesi tidak valid.', 401)


@jwt.expired_token_loader
def expired(_header, _payload):
    return fail('Sesi telah berakhir. Silakan login kembali.', 401)


@jwt.revoked_token_loader
def revoked_response(_header, _payload):
    return fail('Sesi sudah berakhir.', 401)


@auth.before_request
def check_origin():
    # Actual server-side origin rejection, in addition to CORS response headers.
    if request.method in {'POST', 'PUT', 'PATCH', 'DELETE'}:
        if request.headers.get('Origin') not in current_app.config['AUTH_ALLOWED_ORIGINS']:
            return fail('Origin tidak diizinkan.', 403)
        if not request.is_json:
            return fail('Kirim data JSON.', 415)
        if request.content_length and request.content_length > 8192:
            return fail('Data terlalu besar.', 413)


@auth.after_request
def private_response(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


def credentials(register=False):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValueError('Data tidak valid.')
    email, password = data.get('email'), data.get('password')
    if not isinstance(email, str) or not isinstance(password, str):
        raise ValueError('Email dan password wajib diisi.')
    email = email.strip().lower()
    if len(email) > 150 or not 1 <= len(password) <= 128:
        raise ValueError('Email atau panjang password tidak valid.')
    try:
        validate_email(email, check_deliverability=False)
    except EmailNotValidError:
        raise ValueError('Format email tidak valid.') from None
    username = data.get('username')
    if register:
        if not isinstance(username, str) or not 3 <= len(username.strip()) <= 100:
            raise ValueError('Username harus 3 sampai 100 karakter.')
        if len(password) < 8:
            raise ValueError('Password minimal 8 karakter.')
        username = username.strip()
    return email, password, username


@auth.post('/register')
@limiter.limit('5 per hour')
def register():
    try:
        email, password, username = credentials(register=True)
    except ValueError as error:
        return fail(str(error), 400)
    if User.query.filter(func.lower(User.email) == email).first():
        return fail('Email sudah digunakan.', 409)
    user = User(username=username, email=email, password=generate_password_hash(password))
    try:
        db.session.add(user)
        db.session.flush()
        # Never accept role from browser input.
        db.session.add(AccountProfile(user_id=user.id, role='user'))
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return fail('Email sudah digunakan.', 409)
    return jsonify(success=True, message='Akun berhasil dibuat. Silakan login.'), 201


@auth.post('/login')
@limiter.limit('10 per minute')
def login():
    try:
        email, password, _username = credentials()
    except ValueError:
        return fail('Email atau password salah.', 401)
    user = User.query.filter(func.lower(User.email) == email).first()
    password_hash = user.password if user else current_app.extensions['auth_dummy_hash']
    if not check_password_hash(password_hash, password) or not user:
        return fail('Email atau password salah.', 401)
    token = create_access_token(identity=str(user.id))
    response = jsonify(success=True, user=public_user(user), csrf_token=get_csrf_token(token))
    set_access_cookies(response, token)
    return response


def account_required(view):
    @wraps(view)
    @jwt_required()
    def wrapped(*args, **kwargs):
        identity = get_jwt_identity()
        if not isinstance(identity, str) or not identity.isdecimal():
            return fail('Sesi tidak valid.', 401)
        g.current_user = db.session.get(User, int(identity))
        if g.current_user is None:
            return fail('Akun tidak ditemukan.', 401)
        return view(*args, **kwargs)
    return wrapped


def admin_required(view):
    @wraps(view)
    @account_required
    def wrapped(*args, **kwargs):
        if public_user(g.current_user)['role'] != 'admin':
            return fail('Akses admin diperlukan.', 403)
        return view(*args, **kwargs)
    return wrapped


@auth.get('/me')
@limiter.limit('60 per minute')
@account_required
def me():
    return jsonify(success=True, user=public_user(g.current_user), csrf_token=get_jwt()['csrf'])


@auth.post('/logout')
@limiter.limit('10 per minute')
@account_required
def logout():
    payload = get_jwt()
    db.session.merge(RevokedToken(jti=payload['jti'], expires_at=payload['exp']))
    db.session.commit()
    response = jsonify(success=True, message='Logout berhasil.')
    unset_jwt_cookies(response)
    return response
