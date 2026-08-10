import midtransclient
import config

snap = midtransclient.Snap(
    is_production=True,
    server_key=config.MIDTRANS_SERVER_KEY,
    client_key=config.MIDTRANS_CLIENT_KEY
)