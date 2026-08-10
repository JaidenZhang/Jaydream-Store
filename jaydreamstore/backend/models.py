from database import db


class User(db.Model):

    id = db.Column(db.Integer, primary_key=True)

    username = db.Column(db.String(100), nullable=False)

    email = db.Column(db.String(150), unique=True, nullable=False)

    password = db.Column(db.String(255), nullable=False)


class Order(db.Model):

    id = db.Column(db.Integer, primary_key=True)

    order_id = db.Column(
        db.String(100),
        unique=True,
        nullable=False
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id"),
        nullable=True
    )

    product_id = db.Column(
        db.Integer,
        nullable=False
    )

    product_name = db.Column(
        db.String(255),
        nullable=False
    )

    email = db.Column(
        db.String(150),
        nullable=False
    )

    price = db.Column(
        db.Integer,
        nullable=False
    )

    payment_status = db.Column(
        db.String(30),
        default="pending"
    )

    email_status = db.Column(
        db.String(30),
        default="pending"
    )

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now()
    )