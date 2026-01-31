import base64
import codecs
import html
import json
import re
import zlib
from hashlib import md5, sha1, sha256, sha512
from hmac import new as hmac_new
from typing import Callable, Dict
from urllib.parse import quote, unquote

import yaml


def _to_bytes(value: str) -> bytes:
    return value.encode("utf-8", errors="replace")


def _from_bytes(value: bytes) -> str:
    return value.decode("utf-8", errors="replace")


def _split_tokens(value: str) -> list:
    if not value:
        return []
    if re.search(r"\s", value):
        return [t for t in re.split(r"\s+", value.strip()) if t]
    return [value]


def _chunk_string(value: str, size: int) -> list:
    return [value[i : i + size] for i in range(0, len(value), size)]


# Encoding

def base64_encode(value: str) -> str:
    return base64.b64encode(_to_bytes(value)).decode("ascii")


def base64_decode(value: str) -> str:
    return _from_bytes(base64.b64decode(value.encode("ascii"), validate=False))


def url_encode(value: str) -> str:
    return quote(value, safe="")


def url_decode(value: str) -> str:
    return unquote(value)


def html_encode(value: str) -> str:
    return html.escape(value)


def html_decode(value: str) -> str:
    return html.unescape(value)


def to_hex(value: str) -> str:
    return _to_bytes(value).hex()


def from_hex(value: str) -> str:
    tokens = _split_tokens(value)
    if len(tokens) == 1 and len(tokens[0]) % 2 == 0:
        return _from_bytes(bytes.fromhex(tokens[0]))
    return _from_bytes(bytes(int(t, 16) for t in tokens))


def to_octal(value: str) -> str:
    return " ".join(format(b, "03o") for b in _to_bytes(value))


def from_octal(value: str) -> str:
    tokens = _split_tokens(value)
    return _from_bytes(bytes(int(t, 8) for t in tokens))


def to_binary(value: str) -> str:
    return " ".join(format(b, "08b") for b in _to_bytes(value))


def from_binary(value: str) -> str:
    tokens = _split_tokens(value)
    if len(tokens) == 1 and len(tokens[0]) % 8 == 0:
        tokens = _chunk_string(tokens[0], 8)
    return _from_bytes(bytes(int(t, 2) for t in tokens))


def to_decimal(value: str) -> str:
    return " ".join(str(b) for b in _to_bytes(value))


def from_decimal(value: str) -> str:
    tokens = _split_tokens(value)
    return _from_bytes(bytes(int(t, 10) for t in tokens))


def to_charcode(value: str) -> str:
    return " ".join(str(ord(ch)) for ch in value)


def from_charcode(value: str, delimiter: str = " ") -> str:
    if delimiter:
        tokens = [t for t in value.split(delimiter) if t != ""]
    else:
        tokens = _split_tokens(value)
    return "".join(chr(int(t, 10)) for t in tokens)


# Hashing

def _hash(value: str, algo) -> str:
    return algo(_to_bytes(value)).hexdigest()


def md5_hash(value: str) -> str:
    return _hash(value, md5)


def sha1_hash(value: str) -> str:
    return _hash(value, sha1)


def sha2_256(value: str) -> str:
    return _hash(value, sha256)


def sha2_512(value: str) -> str:
    return _hash(value, sha512)


def hmac_hash(value: str, key: str = "", digest: str = "sha256") -> str:
    digest = digest.lower()
    algos = {
        "md5": md5,
        "sha1": sha1,
        "sha256": sha256,
        "sha512": sha512,
    }
    if digest not in algos:
        raise ValueError("Unsupported digest")
    return hmac_new(_to_bytes(key), _to_bytes(value), algos[digest]).hexdigest()


def crc32_checksum(value: str) -> str:
    return format(zlib.crc32(_to_bytes(value)) & 0xFFFFFFFF, "08x")


# Encryption

def rot_13(value: str) -> str:
    return codecs.encode(value, "rot_13")


def xor(value: str, key: str = "") -> str:
    if not key:
        return value
    value_bytes = _to_bytes(value)
    key_bytes = _to_bytes(key)
    out = bytes(b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(value_bytes))
    return _from_bytes(out)


def jwt_decode(value: str) -> str:
    parts = value.split(".")
    if len(parts) < 2:
        raise ValueError("Invalid JWT")

    def _b64url_decode(data: str) -> str:
        padding = "=" * (-len(data) % 4)
        return _from_bytes(base64.urlsafe_b64decode(data + padding))

    header = json.loads(_b64url_decode(parts[0]))
    payload = json.loads(_b64url_decode(parts[1]))
    return json.dumps({"header": header, "payload": payload}, indent=2)


# Compression

def zlib_compress(value: str) -> str:
    return base64.b64encode(zlib.compress(_to_bytes(value))).decode("ascii")


def zlib_decompress(value: str) -> str:
    return _from_bytes(zlib.decompress(base64.b64decode(value.encode("ascii"))))


def gzip_compress(value: str) -> str:
    return base64.b64encode(zlib.compress(_to_bytes(value), wbits=31)).decode("ascii")


def gzip_decompress(value: str) -> str:
    return _from_bytes(zlib.decompress(base64.b64decode(value.encode("ascii")), wbits=31))


# Data Format

def str_to_json(value: str) -> str:
    return json.dumps(json.loads(value), indent=2)


def json_to_yaml(value: str) -> str:
    return yaml.safe_dump(json.loads(value), sort_keys=False).strip()


def yaml_to_json(value: str) -> str:
    return json.dumps(yaml.safe_load(value), indent=2)


# String

def reverse(value: str) -> str:
    return value[::-1]


def upper_case(value: str) -> str:
    return value.upper()


def lower_case(value: str) -> str:
    return value.lower()


def trim(value: str) -> str:
    return value.strip()


def count_occurances(value: str, pattern: str = "") -> str:
    if not pattern:
        return "0"
    return str(len(re.findall(pattern, value)))


def find_replace(value: str, pattern: str = "", repl: str = "") -> str:
    if not pattern:
        return value
    return re.sub(pattern, repl, value)


def regex_search(value: str, pattern: str = "") -> str:
    if not pattern:
        return "[]"
    return json.dumps(re.findall(pattern, value))


def length(value: str) -> str:
    return str(len(value))


def escape_string(value: str) -> str:
    return json.dumps(value)[1:-1]


def unescape_string(value: str) -> str:
    return codecs.decode(value, "unicode_escape")


OPERATION_MAP: Dict[str, Callable[..., str]] = {
    # Encoding
    "base64_encode": base64_encode,
    "base64_decode": base64_decode,
    "url_encode": url_encode,
    "url_decode": url_decode,
    "html_encode": html_encode,
    "html_decode": html_decode,
    "to_hex": to_hex,
    "from_hex": from_hex,
    "to_octal": to_octal,
    "from_octal": from_octal,
    "to_binary": to_binary,
    "from_binary": from_binary,
    "to_decimal": to_decimal,
    "from_decimal": from_decimal,
    "to_charcode": to_charcode,
    "from_charcode": from_charcode,
    # Hashing
    "md5": md5_hash,
    "sha1": sha1_hash,
    "sha2_256": sha2_256,
    "sha2_512": sha2_512,
    "hmac_hash": hmac_hash,
    "crc32_checksum": crc32_checksum,
    # Encryption
    "rot_13": rot_13,
    "xor": xor,
    "jwt_decode": jwt_decode,
    # Compression
    "zlib_compress": zlib_compress,
    "zlib_decompress": zlib_decompress,
    "gzip_compress": gzip_compress,
    "gzip_decompress": gzip_decompress,
    # Data Format
    "str_to_json": str_to_json,
    "json_to_yaml": json_to_yaml,
    "yaml_to_json": yaml_to_json,
    # String
    "reverse": reverse,
    "upper_case": upper_case,
    "lower_case": lower_case,
    "trim": trim,
    "count_occurances": count_occurances,
    "find_replace": find_replace,
    "regex_search": regex_search,
    "length": length,
    "escape_string": escape_string,
    "unescape_string": unescape_string,
}


def run_operation(name: str, value: str, args: dict) -> str:
    func = OPERATION_MAP.get(name)
    if not func:
        raise ValueError(f"Unknown operation: {name}")
    return func(value, **args)
