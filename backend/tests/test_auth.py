import sys
from pathlib import Path
from datetime import timedelta
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from flask import Flask, jsonify
from flask_jwt_extended import create_access_token
from werkzeug.security import check_password_hash
from database import db
from models import User
from auth import init_auth, limiter, admin_required
import contact

ORIGIN = 'http://localhost:5500'
DATA = dict(username='Jaiden', email='test@example.com', password='password-for-tests')


@pytest.fixture
def app(monkeypatch):
    monkeypatch.setenv('APP_ENV', 'development')
    monkeypatch.setenv('AUTH_SECRET_KEY', 'test-only-key-' * 4)
    monkeypatch.setenv('AUTH_ALLOWED_ORIGINS', ORIGIN)
    monkeypatch.setenv('AUTH_RATE_STORAGE', 'memory://')
    app = Flask(__name__)
    app.config.update(TESTING=True, SQLALCHEMY_DATABASE_URI='sqlite://')
    db.init_app(app)
    init_auth(app)

    @app.get('/admin-test')
    @admin_required
    def admin_test():
        return jsonify(success=True)

    with app.app_context():
        db.create_all()
        limiter.reset()
    yield app
    with app.app_context():
        db.session.remove()
        db.drop_all()


def post(client, path, data, **headers):
    return client.post(path, json=data, headers={'Origin': ORIGIN, **headers})


def login(client):
    assert post(client, '/register', DATA).status_code == 201
    result = post(client, '/login', DATA)
    assert result.status_code == 200
    return result


def test_register_hash_role_normalization(app):
    client = app.test_client()
    data = dict(DATA, email=' TEST@EXAMPLE.COM ', role='admin')
    assert post(client, '/register', data).status_code == 201
    with app.app_context():
        user = User.query.one()
        assert user.email == 'test@example.com'
        assert user.password != DATA['password']
        assert check_password_hash(user.password, DATA['password'])
    result = post(client, '/login', DATA)
    assert result.json['user']['role'] == 'user'
    assert 'password' not in result.json['user']


@pytest.mark.parametrize('data', [None, [], {}, dict(DATA, password='abc'),
    dict(DATA, email='invalid'), dict(DATA, username='ab'), dict(DATA, password=42)])
def test_invalid_register(app, data):
    assert post(app.test_client(), '/register', data).status_code in (400, 415)


def test_duplicate(app):
    c = app.test_client()
    assert post(c, '/register', DATA).status_code == 201
    assert post(c, '/register', dict(DATA, email='TEST@EXAMPLE.COM')).status_code == 409


def test_login_generic_error(app):
    c = app.test_client()
    post(c, '/register', DATA)
    a = post(c, '/login', dict(DATA, password='wrong'))
    b = post(c, '/login', dict(DATA, email='absent@example.com'))
    assert a.status_code == b.status_code == 401
    assert a.json == b.json


def test_session_logout_replay(app):
    c = app.test_client()
    assert c.get('/me').status_code == 401
    result = login(c)
    assert 'HttpOnly' in result.headers['Set-Cookie']
    assert 'SameSite=Lax' in result.headers['Set-Cookie']
    token = c.get_cookie('jd_access').value
    me = c.get('/me')
    assert me.status_code == 200
    assert me.headers['Cache-Control'] == 'no-store'
    assert post(c, '/logout', {}).status_code == 401
    assert post(c, '/logout', {}, **{'X-CSRF-TOKEN': 'wrong'}).status_code == 401
    assert post(c, '/logout', {}, **{'X-CSRF-TOKEN': me.json['csrf_token']}).status_code == 200
    assert c.get('/me').status_code == 401
    c.set_cookie('jd_access', token)
    assert c.get('/me').status_code == 401


def test_origin_and_cors(app):
    c = app.test_client()
    assert c.post('/login', json=DATA).status_code == 403
    assert c.post('/login', json=DATA, headers={'Origin': 'https://evil.example'}).status_code == 403
    result = c.options('/login', headers={'Origin': ORIGIN, 'Access-Control-Request-Method': 'POST'})
    assert result.headers['Access-Control-Allow-Origin'] == ORIGIN
    assert result.headers['Access-Control-Allow-Credentials'] == 'true'


def test_admin_denied(app):
    c = app.test_client()
    login(c)
    assert c.get('/admin-test').status_code == 403


def test_expired_and_tampered(app):
    c = app.test_client()
    login(c)
    with app.app_context():
        token = create_access_token(identity='1', expires_delta=timedelta(seconds=-1))
    c.set_cookie('jd_access', token)
    assert c.get('/me').status_code == 401
    c.set_cookie('jd_access', 'not.a.valid-token')
    assert c.get('/me').status_code == 401


def test_rate_limit(app):
    c = app.test_client()
    for _ in range(10):
        assert post(c, '/login', DATA).status_code == 401
    assert post(c, '/login', DATA).status_code == 429


def test_secure_cookie(app):
    app.config['JWT_COOKIE_SECURE'] = True
    result = login(app.test_client())
    assert 'Secure;' in result.headers['Set-Cookie']


def test_missing_secret(monkeypatch):
    monkeypatch.delenv('AUTH_SECRET_KEY', raising=False)
    with pytest.raises(RuntimeError, match='AUTH_SECRET_KEY'):
        init_auth(Flask('missing'))


def test_production_storage_guard(monkeypatch):
    monkeypatch.setenv('AUTH_SECRET_KEY', 'test-only-key-' * 4)
    monkeypatch.setenv('APP_ENV', 'production')
    monkeypatch.setenv('AUTH_ALLOWED_ORIGINS', 'https://jaydream.store')
    monkeypatch.setenv('AUTH_RATE_STORAGE', 'memory://')
    with pytest.raises(RuntimeError, match='Redis'):
        init_auth(Flask('production'))


def test_contact_delivery_mocked(app, monkeypatch):
    from unittest.mock import MagicMock
    monkeypatch.setattr(contact.config, 'EMAIL_ADDRESS', 'official@jaydream.store')
    monkeypatch.setattr(contact.config, 'EMAIL_PASSWORD', 'test-not-real')
    smtp = MagicMock()
    monkeypatch.setattr(contact.smtplib, 'SMTP_SSL', smtp)
    payload = dict(name='Tester', email='tester@example.com', subject='Saran toko', message='Tolong tambah produk baru.')
    result = post(app.test_client(), '/contact', payload)
    assert result.status_code == 200
    message = smtp.return_value.__enter__.return_value.send_message.call_args.args[0]
    assert message['To'] == 'official@jaydream.store'
    assert message['Reply-To'] == 'tester@example.com'


def test_contact_rejects_bad_input(app):
    c = app.test_client()
    assert post(c, '/contact', {}).status_code == 400
    data = dict(name='Tester', email='test@example.com', subject='Test\nBcc: other@example.com', message='Isi pesan pengujian.')
    assert post(c, '/contact', data).status_code == 400
    data['website'] = 'spam'
    assert post(c, '/contact', data).status_code == 400
