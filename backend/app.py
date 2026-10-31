"""
NAGARWATCH API Gateway Entrypoint
Community Safety & Neighbourhood Intelligence Platform
"""

import os
from app.main import create_app

app = create_app()

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
