"""Print the value for adminCodeHash in docs/data/config.js.

    python tools/admin_code.py "my long owner code"

The site never sees the code itself, only this salted PBKDF2-SHA256 hash, so the
owner code is not stored in the repository and cannot be read from the published
site. Run it again with a new code to change it.
"""
import base64
import hashlib
import secrets
import sys

ITER = 120_000


def main() -> int:
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        print(__doc__)
        return 2
    code = sys.argv[1]
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", code.encode("utf-8"), bytes.fromhex(salt), ITER, dklen=32)
    stored = "pbkdf2$%d$%s$%s" % (ITER, salt, dk.hex())
    print("\nPaste this line into docs/data/config.js:\n")
    print("  adminCodeHash: '%s',\n" % stored)
    print("Keep the code itself somewhere safe — it is not recoverable from this hash.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
